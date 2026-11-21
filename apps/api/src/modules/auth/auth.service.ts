import { type DeviceIntegrityBody, type Gates, type MeAccount, type OtpRequestBody, type OtpVerifyBody, makePublicRef, RefPrefix, ROLE_PERMISSIONS, toE164India, type Role } from '@kbs/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OTP_PROVIDER, type OtpProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { GatesService } from '../gates/gates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HierarchyService } from '../users/hierarchy.service';
import { UsersService } from '../users/users.service';

import { TokenService } from './token.service';

const MASTER_CODE_ALLOWED_ENVS = new Set(['development', 'test', 'staging']);
/** pg advisory-lock namespace that serialises OTP sends per mobile (F-908 S4). */
const OTP_SEND_LOCK_NS = 90801;

/** ADR-015: a used refresh token is accepted again only within this window, and only while its successor is unused. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/** F-101: OTP-only authentication, rotating refresh tokens, session policy. */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly gates: GatesService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly hierarchy: HierarchyService,
    private readonly notifications: NotificationsService,
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Same response whether or not the number exists (REQ-23 §23.1). */
  async requestOtp(body: OtpRequestBody, ip: string) {
    const mobile = toE164India(body.mobile);
    const expirySec = this.config.getInt('auth.otp.expirySec') ?? 300;
    const cooldown = this.config.getInt('auth.otp.resendCooldownSec') ?? 60;
    const hourAgo = new Date(Date.now() - 3_600_000);

    const user = await this.prisma.client.user.findUnique({ where: { mobile }, select: { id: true, status: true } });
    const eligible =
      body.purpose === 'ADVISOR_SIGNUP' ? user === null : user !== null && (user.status === 'ACTIVE' || user.status === 'PENDING_ONBOARDING');
    const code = this.crypto.randomOtp();
    // F-908 S4: the cooldown / hourly caps and the new challenge are one atomic step per mobile. Without the advisory
    // lock a parallel burst passes every count before any challenge exists and sends one SMS per request. A request that
    // finds another send for the same number in flight is answered "too soon" at once instead of queueing on the lock.
    const challenge = await this.prisma.client.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ ok: boolean }>>`SELECT pg_try_advisory_xact_lock(${OTP_SEND_LOCK_NS}::int, hashtext(${mobile})) AS ok`;
      if (!lock?.ok) {
        throw new AppError('AUTH_OTP_RESEND_TOO_SOON', `Please wait ${cooldown} seconds before requesting another code.`, { retryAfterSec: cooldown, cooldownSec: cooldown }, 'RETRY_LATER');
      }
      const [lastForMobile, sendsMobile, sendsIp] = await Promise.all([
        tx.otpChallenge.findFirst({ where: { mobile }, orderBy: { createdAt: 'desc' } }),
        tx.otpChallenge.count({ where: { mobile, createdAt: { gte: hourAgo } } }),
        tx.otpChallenge.count({ where: { ip, createdAt: { gte: hourAgo } } }),
      ]);
      if (lastForMobile && Date.now() - lastForMobile.createdAt.getTime() < cooldown * 1000) {
        // the real time left (not the full cooldown), so clients can run a live countdown and re-enable the button themselves
        const retryAfterSec = Math.max(1, Math.ceil((cooldown * 1000 - (Date.now() - lastForMobile.createdAt.getTime())) / 1000));
        throw new AppError('AUTH_OTP_RESEND_TOO_SOON', `Please wait ${retryAfterSec} second${retryAfterSec === 1 ? '' : 's'} before requesting another code.`, { retryAfterSec, cooldownSec: cooldown }, 'RETRY_LATER');
      }
      if (sendsMobile >= (this.config.getInt('auth.otp.maxSendsPerMobilePerHour') ?? 10) || sendsIp >= (this.config.getInt('auth.otp.maxSendsPerIpPerHour') ?? 30)) {
        throw new AppError('AUTH_OTP_RATE_LIMITED', 'Too many code requests. Try again later.', undefined, 'RETRY_LATER');
      }
      if (await this.isLocked(mobile, tx)) throw new AppError('AUTH_OTP_LOCKED', 'Too many wrong attempts. Try again later.', undefined, 'RETRY_LATER');
      const created = await tx.otpChallenge.create({
        data: { mobile, purpose: body.purpose, codeHash: '', phantom: !eligible, expiresAt: new Date(Date.now() + expirySec * 1000), ip },
      });
      return tx.otpChallenge.update({ where: { id: created.id }, data: { codeHash: this.crypto.hashOtp(code, created.id) } });
    });
    if (eligible) {
      try {
        await this.otp.send(mobile, code);
      } catch {
        // the SMS provider refused or timed out: drop the challenge so the failed send does not start the resend cooldown,
        // and answer with a retryable error instead of a 500
        await this.prisma.client.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
        throw new AppError('AUTH_OTP_SEND_FAILED', 'We could not send the code. Please try again in a moment.', undefined, 'RETRY_LATER');
      }
    }
    return { challengeId: challenge.id, expiresInSec: expirySec, resendAfterSec: cooldown };
  }

  async verifyOtp(body: OtpVerifyBody, ip: string, userAgent?: string) {
    const ch = await this.prisma.client.otpChallenge.findUnique({ where: { id: body.challengeId } });
    if (!ch || ch.consumedAt) throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.', undefined, 'LOGIN_AGAIN');
    if (ch.expiresAt.getTime() < Date.now()) throw new AppError('AUTH_OTP_EXPIRED', 'This code has expired. Request a new one.', undefined, 'LOGIN_AGAIN');
    if (await this.isLocked(ch.mobile)) throw new AppError('AUTH_OTP_LOCKED', 'Too many wrong attempts. Try again later.', undefined, 'RETRY_LATER');
    const maxAttempts = this.config.getInt('auth.otp.maxAttempts') ?? 5;

    // F-908 S1: reserve an attempt atomically BEFORE comparing, so parallel guesses can never evaluate more than
    // maxAttempts codes on one challenge; a refused reservation means the challenge is spent or used up.
    const reserved = await this.prisma.client.otpChallenge.updateMany({ where: { id: ch.id, consumedAt: null, attempts: { lt: maxAttempts } }, data: { attempts: { increment: 1 } } });
    if (reserved.count === 0) {
      const now = await this.prisma.client.otpChallenge.findUnique({ where: { id: ch.id }, select: { consumedAt: true } });
      if (!now || now.consumedAt) throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.', undefined, 'LOGIN_AGAIN');
      throw new AppError('AUTH_OTP_LOCKED', 'Too many wrong attempts. Try again later.', undefined, 'RETRY_LATER');
    }

    const masterOk = Boolean(this.env.OTP_DEV_MASTER_CODE) && MASTER_CODE_ALLOWED_ENVS.has(this.env.NODE_ENV) && body.code === this.env.OTP_DEV_MASTER_CODE;
    const ok = !ch.phantom && (masterOk || this.crypto.safeEqual(ch.codeHash, this.crypto.hashOtp(body.code, ch.id)));
    if (!ok) {
      const after = await this.prisma.client.otpChallenge.findUnique({ where: { id: ch.id }, select: { attempts: true } });
      if ((after?.attempts ?? maxAttempts) >= maxAttempts) await this.lock(ch.mobile);
      throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.');
    }
    // consume exactly once (one code → one session); the right code gives its reserved attempt back, so a sign-in
    // that succeeds on the last try does not leave the number looking locked
    const consumed = await this.prisma.client.otpChallenge.updateMany({ where: { id: ch.id, consumedAt: null }, data: { consumedAt: new Date(), attempts: { decrement: 1 } } });
    if (consumed.count === 0) throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.', undefined, 'LOGIN_AGAIN');

    let user = await this.prisma.client.user.findUnique({ where: { mobile: ch.mobile } });
    if (ch.purpose === 'ADVISOR_SIGNUP') {
      if (user) throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.');
      user = await this.prisma.client.user.create({
        data: {
          publicRef: makePublicRef(RefPrefix.USER),
          mobile: ch.mobile,
          role: 'ADVISOR',
          status: 'PENDING_ONBOARDING',
          fullName: '',
          lifecycleEvents: { create: { eventType: 'CREATED', reason: 'advisor self-registration' } },
          advisorProfile: { create: { onboardingStep: 'PERSONAL' } },
        },
      });
      const adminId = await this.hierarchy.adminUserId();
      await this.prisma.client.reportingAssignment.create({ data: { childUserId: user.id, parentUserId: adminId, source: 'ADMIN_DEFAULT', status: 'ACTIVE' } });
    }
    if (!user) throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.');
    if (user.status === 'DEACTIVATED' || user.status === 'BLOCKED') {
      throw new AppError('AUTH_ACCOUNT_DEACTIVATED', 'This account is not active. Contact your Manager or Admin.', undefined, user.role === 'TELECALLER' ? 'CONTACT_MANAGER' : 'CONTACT_ADMIN');
    }
    if (body.platform === 'WEB') {
      const allowed = this.config.getJson<string[]>('auth.webAccessRoles');
      if (!allowed.includes(user.role)) throw new AppError('AUTH_PLATFORM_NOT_ALLOWED', 'This role uses the mobile app, not the web application.');
    }

    // Telecaller first successful login starts the 72-hour window exactly once (REQ-05 §5.1).
    if (user.role === 'TELECALLER') {
      const hours = this.config.getInt('training.windowHours') ?? 72;
      await this.prisma.client.trainingEnrollment.updateMany({
        where: { telecallerUserId: user.id, firstLoginAt: null, status: 'NOT_STARTED' },
        data: { firstLoginAt: new Date(), deadlineAt: new Date(Date.now() + hours * 3_600_000), status: 'IN_PROGRESS', currentModuleSequence: 1 },
      });
      if (this.config.getBool('auth.telecallerSingleSession')) {
        await this.prisma.client.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'NEW_LOGIN' } });
        await this.notifications.revokeDevicesForSessions({ userId: user.id }); // F-701: old phone stops receiving pushes
      }
    }

    const session = await this.prisma.client.session.create({
      data: { userId: user.id, platform: body.platform, deviceId: body.deviceId, userAgent: userAgent?.slice(0, 256), ipAtLogin: ip, pushToken: body.pushToken },
    });
    await this.prisma.client.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const refresh = await this.issueRefresh(session.id, null);
    const accessMinutes = this.config.getInt('auth.accessTokenMinutes') ?? 15;
    const accessToken = this.tokens.signAccess({ sub: user.id, sid: session.id, role: user.role }, accessMinutes);
    await this.audit.record({ action: 'auth.login', entityType: 'User', entityId: user.id, actor: { userId: user.id, role: user.role }, metadata: { platform: body.platform, sessionId: session.id } });

    const actor = await this.buildActor(user.id, session.id);
    const gates = await this.gates.compute(actor, ip);
    return { accessToken, refreshToken: refresh, accessExpiresInSec: accessMinutes * 60, user: await this.users.toSummary(user), gates, permissions: [...actor.permissions] };
  }

  async refresh(rawToken: string, ip: string) {
    const tokenHash = this.crypto.hashToken(rawToken);
    const rt = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash }, include: { session: { include: { user: true } } } });
    if (!rt) throw new AppError('AUTH_INVALID_TOKEN', 'Session is not valid. Please log in again.', undefined, 'LOGIN_AGAIN');
    // ADR-015: claim the token atomically — of two concurrent requests with the same token only one rotates normally
    const claimed = rt.usedAt ? 0 : (await this.prisma.client.refreshToken.updateMany({ where: { id: rt.id, usedAt: null }, data: { usedAt: new Date() } })).count;
    let grace = false;
    if (!claimed) {
      // Already used. A retry of a refresh whose response was lost (or a concurrent twin) is benign only while the
      // token was used moments ago and its successor was never used; anything else is reuse → revoke (REQ-21 §21.5).
      const used = await this.prisma.client.refreshToken.findUniqueOrThrow({ where: { id: rt.id }, select: { usedAt: true, replacedById: true } });
      const successor = used.replacedById ? await this.prisma.client.refreshToken.findUnique({ where: { id: used.replacedById }, select: { usedAt: true } }) : null;
      grace = Boolean(used.usedAt && Date.now() - used.usedAt.getTime() < REFRESH_REUSE_GRACE_MS && !successor?.usedAt && !rt.session.revokedAt);
      if (!grace) {
        await this.prisma.client.session.update({ where: { id: rt.sessionId }, data: { revokedAt: new Date(), revokedReason: 'REFRESH_REUSE' } });
        await this.audit.record({ action: 'auth.refresh.reuse', entityType: 'Session', entityId: rt.sessionId, actor: { userId: rt.session.userId, role: rt.session.user.role } });
        throw new AppError('AUTH_SESSION_REVOKED', 'Session revoked for security. Please log in again.', undefined, 'LOGIN_AGAIN');
      }
    }
    const user = rt.session.user;
    // F-804: deactivation also revokes sessions — say why (REQ-25 §25.1 "account-deactivated explanation") rather than "expired"
    if (user.status === 'DEACTIVATED' || user.status === 'BLOCKED') throw new AppError('AUTH_ACCOUNT_DEACTIVATED', 'This account is not active. Contact your Manager or Admin.', undefined, user.role === 'TELECALLER' ? 'CONTACT_MANAGER' : 'CONTACT_ADMIN');
    if (rt.expiresAt.getTime() < Date.now() || rt.session.revokedAt) throw new AppError('AUTH_SESSION_REVOKED', 'Session expired. Please log in again.', undefined, 'LOGIN_AGAIN');

    // normal rotation links the successor; a grace retry gets a sibling in the same family and leaves the chain as is
    const newRaw = await this.issueRefresh(rt.sessionId, rt.familyId, grace ? undefined : rt.id);
    if (grace) await this.audit.record({ action: 'auth.refresh.grace', entityType: 'Session', entityId: rt.sessionId, actor: { userId: user.id, role: user.role } });
    await this.prisma.client.session.update({ where: { id: rt.sessionId }, data: { lastSeenAt: new Date() } });
    const accessMinutes = this.config.getInt('auth.accessTokenMinutes') ?? 15;
    const accessToken = this.tokens.signAccess({ sub: user.id, sid: rt.sessionId, role: user.role }, accessMinutes);
    const actor = await this.buildActor(user.id, rt.sessionId);
    return { accessToken, refreshToken: newRaw, accessExpiresInSec: accessMinutes * 60, user: await this.users.toSummary(user), gates: await this.gates.compute(actor, ip), permissions: [...actor.permissions] };
  }

  async logout(sessionId: string, all: boolean, userId: string) {
    await this.prisma.client.session.updateMany({ where: all ? { userId, revokedAt: null } : { id: sessionId }, data: { revokedAt: new Date(), revokedReason: all ? 'LOGOUT_ALL' : 'LOGOUT' } });
    await this.notifications.revokeDevicesForSessions(all ? { userId } : { sessionId });
  }

  async me(actor: Actor, ip: string): Promise<{ user: unknown; gates: Gates; permissions: string[]; account: MeAccount }> {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: actor.userId } });
    const account: MeAccount = {
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      supportContact: this.config.getString('support.contact') ?? null,
      accessExpiresInSec: (this.config.getInt('auth.accessTokenMinutes') ?? 15) * 60,
    };
    return { user: await this.users.toSummary(user), gates: await this.gates.compute(actor, ip), permissions: [...actor.permissions], account };
  }

  /**
   * F-302 (REQ-09 §9.3): root detection is a warning, not a block (policy OPEN). The report is audited on the session;
   * a rooted device raises one Admin SECURITY_EVENT per session.
   */
  async reportDeviceIntegrity(actor: Actor, body: DeviceIntegrityBody) {
    RequestContextStore.audit({ entityId: actor.sessionId, after: { rooted: body.rooted, platform: body.platform, appVersion: body.appVersion ?? null, deviceModel: body.deviceModel ?? null }, metadata: { userId: actor.userId, role: actor.role } });
    if (body.rooted) {
      const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { publicRef: true, role: true } });
      const adminId = await this.hierarchy.adminUserId();
      await this.notifications.notify({ recipientUserId: adminId, kind: 'SECURITY_EVENT', title: 'App used on a rooted / compromised device', body: `${user.role.toLowerCase()} ${user.publicRef} signed in on a device that looks rooted (${body.deviceModel ?? body.platform}). Screen protection may not hold on such devices; access was not blocked.`, deepLink: { entityType: 'User', entityId: actor.userId }, dedupeKey: `security:rooted:${actor.sessionId}` });
    }
    return { recorded: true, warning: body.rooted ? 'This device appears to be rooted. Screen protection may not work; avoid viewing customer or bank details on it.' : null };
  }

  /** Builds the Actor for guards/scoping from a verified access token (F-102). */
  async buildActor(userId: string, sessionId: string): Promise<Actor> {
    const [user, session] = await Promise.all([
      this.prisma.client.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } }),
      this.prisma.client.session.findUnique({ where: { id: sessionId }, select: { revokedAt: true } }),
    ]);
    if (!user || !session || session.revokedAt) throw new AppError('AUTH_SESSION_REVOKED', 'Session is no longer valid.', undefined, 'LOGIN_AGAIN');
    const role = user.role as Role;
    const [teamUserIds, referralUserIds, reportingParentUserId] = await Promise.all([
      role === 'MANAGER' ? this.hierarchy.teamUserIds(user.id) : Promise.resolve([]),
      role === 'ADVISOR' ? this.hierarchy.directReportIds(user.id) : Promise.resolve([]), // F-824
      this.hierarchy.currentParentId(user.id),
    ]);
    return { userId: user.id, role, status: user.status, sessionId, permissions: ROLE_PERMISSIONS[role], teamUserIds, referralUserIds, reportingParentUserId };
  }

  private async issueRefresh(sessionId: string, familyId: string | null, replacesId?: string): Promise<string> {
    const raw = this.crypto.randomToken();
    const days = this.config.getInt('auth.refreshTokenDays') ?? 30;
    const created = await this.prisma.client.refreshToken.create({
      data: { sessionId, tokenHash: this.crypto.hashToken(raw), familyId: familyId ?? sessionId, expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    // usedAt was set by the atomic claim in refresh(); this only links the successor
    if (replacesId) await this.prisma.client.refreshToken.update({ where: { id: replacesId }, data: { replacedById: created.id } });
    return raw;
  }

  private lockKey(mobile: string) {
    return `otp:lock:${mobile}`;
  }
  private async isLocked(mobile: string, db: Pick<PrismaService['client'], 'otpChallenge'> = this.prisma.client): Promise<boolean> {
    const lock = await db.otpChallenge.findFirst({
      where: { mobile, attempts: { gte: this.config.getInt('auth.otp.maxAttempts') ?? 5 }, createdAt: { gte: new Date(Date.now() - (this.config.getInt('auth.otp.lockMinutes') ?? 15) * 60_000) } },
      select: { id: true },
    });
    return Boolean(lock);
  }
  /** Lock state is derived from the attempts counter + lockMinutes window (see isLocked). F-701: tell Admin (privileged-security event, REQ-19 §19.1). */
  private async lock(mobile: string): Promise<void> {
    const user = await this.prisma.client.user.findUnique({ where: { mobile }, select: { id: true, role: true, publicRef: true } });
    if (!user) return; // unknown numbers never generate account-revealing notifications
    const adminId = await this.hierarchy.adminUserId().catch(() => null);
    if (!adminId) return;
    const window = Math.floor(Date.now() / ((this.config.getInt('auth.otp.lockMinutes') ?? 15) * 60_000));
    await this.notifications.notify({ recipientUserId: adminId, kind: 'SECURITY_EVENT', title: 'Sign-in locked after wrong OTPs', body: `${user.role.toLowerCase()} ${user.publicRef} (${mobile}) hit the wrong-code limit; sign-in is locked for ${this.config.getInt('auth.otp.lockMinutes') ?? 15} minutes.`, deepLink: { entityType: 'User', entityId: user.id }, dedupeKey: `security:otp-lock:${user.id}:${window}` });
  }

}
