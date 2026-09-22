import { type Gates, type OtpRequestBody, type OtpVerifyBody, makePublicRef, RefPrefix, ROLE_PERMISSIONS, toE164India, type Role } from '@kbs/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppError } from '../../common/errors/app-error';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OTP_PROVIDER, type OtpProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { GatesService } from '../gates/gates.service';
import { HierarchyService } from '../users/hierarchy.service';
import { UsersService } from '../users/users.service';

import { TokenService } from './token.service';

const MASTER_CODE_ALLOWED_ENVS = new Set(['development', 'test']);

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
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Same response whether or not the number exists (REQ-23 §23.1). */
  async requestOtp(body: OtpRequestBody, ip: string) {
    const mobile = toE164India(body.mobile);
    const expirySec = this.config.getInt('auth.otp.expirySec') ?? 300;
    const cooldown = this.config.getInt('auth.otp.resendCooldownSec') ?? 60;
    const hourAgo = new Date(Date.now() - 3_600_000);

    const [lastForMobile, sendsMobile, sendsIp] = await Promise.all([
      this.prisma.client.otpChallenge.findFirst({ where: { mobile }, orderBy: { createdAt: 'desc' } }),
      this.prisma.client.otpChallenge.count({ where: { mobile, createdAt: { gte: hourAgo } } }),
      this.prisma.client.otpChallenge.count({ where: { ip, createdAt: { gte: hourAgo } } }),
    ]);
    if (lastForMobile && Date.now() - lastForMobile.createdAt.getTime() < cooldown * 1000) {
      throw new AppError('AUTH_OTP_RESEND_TOO_SOON', `Please wait ${cooldown} seconds before requesting another code.`, undefined, 'RETRY_LATER');
    }
    if (sendsMobile >= (this.config.getInt('auth.otp.maxSendsPerMobilePerHour') ?? 10) || sendsIp >= (this.config.getInt('auth.otp.maxSendsPerIpPerHour') ?? 30)) {
      throw new AppError('AUTH_OTP_RATE_LIMITED', 'Too many code requests. Try again later.', undefined, 'RETRY_LATER');
    }
    if (await this.isLocked(mobile)) throw new AppError('AUTH_OTP_LOCKED', 'Too many wrong attempts. Try again later.', undefined, 'RETRY_LATER');

    const user = await this.prisma.client.user.findUnique({ where: { mobile }, select: { id: true, status: true } });
    const eligible =
      body.purpose === 'ADVISOR_SIGNUP' ? user === null : user !== null && (user.status === 'ACTIVE' || user.status === 'PENDING_ONBOARDING');
    const code = this.crypto.randomOtp();
    const challenge = await this.prisma.client.otpChallenge.create({
      data: { mobile, purpose: body.purpose, codeHash: '', phantom: !eligible, expiresAt: new Date(Date.now() + expirySec * 1000), ip },
    });
    await this.prisma.client.otpChallenge.update({ where: { id: challenge.id }, data: { codeHash: this.crypto.hashOtp(code, challenge.id) } });
    if (eligible) await this.otp.send(mobile, code);
    return { challengeId: challenge.id, expiresInSec: expirySec, resendAfterSec: cooldown };
  }

  async verifyOtp(body: OtpVerifyBody, ip: string, userAgent?: string) {
    const ch = await this.prisma.client.otpChallenge.findUnique({ where: { id: body.challengeId } });
    if (!ch || ch.consumedAt) throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.', undefined, 'LOGIN_AGAIN');
    if (ch.expiresAt.getTime() < Date.now()) throw new AppError('AUTH_OTP_EXPIRED', 'This code has expired. Request a new one.', undefined, 'LOGIN_AGAIN');
    if (await this.isLocked(ch.mobile)) throw new AppError('AUTH_OTP_LOCKED', 'Too many wrong attempts. Try again later.', undefined, 'RETRY_LATER');
    const maxAttempts = this.config.getInt('auth.otp.maxAttempts') ?? 5;

    const masterOk = Boolean(this.env.OTP_DEV_MASTER_CODE) && MASTER_CODE_ALLOWED_ENVS.has(this.env.NODE_ENV) && body.code === this.env.OTP_DEV_MASTER_CODE;
    const ok = !ch.phantom && (masterOk || this.crypto.safeEqual(ch.codeHash, this.crypto.hashOtp(body.code, ch.id)));
    if (!ok) {
      const updated = await this.prisma.client.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      if (updated.attempts >= maxAttempts) await this.lock(ch.mobile);
      throw new AppError('AUTH_OTP_INVALID', 'This code is not valid.');
    }
    await this.prisma.client.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });

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
        where: { telecallerUserId: user.id, firstLoginAt: null },
        data: { firstLoginAt: new Date(), deadlineAt: new Date(Date.now() + hours * 3_600_000), status: 'IN_PROGRESS', currentModuleSequence: 1 },
      });
      if (this.config.getBool('auth.telecallerSingleSession')) {
        await this.prisma.client.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'NEW_LOGIN' } });
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
    if (rt.usedAt) {
      // Reuse detection → revoke the whole family (REQ-21 §21.5).
      await this.prisma.client.session.update({ where: { id: rt.sessionId }, data: { revokedAt: new Date(), revokedReason: 'REFRESH_REUSE' } });
      await this.audit.record({ action: 'auth.refresh.reuse', entityType: 'Session', entityId: rt.sessionId, actor: { userId: rt.session.userId, role: rt.session.user.role } });
      throw new AppError('AUTH_SESSION_REVOKED', 'Session revoked for security. Please log in again.', undefined, 'LOGIN_AGAIN');
    }
    if (rt.expiresAt.getTime() < Date.now() || rt.session.revokedAt) throw new AppError('AUTH_SESSION_REVOKED', 'Session expired. Please log in again.', undefined, 'LOGIN_AGAIN');
    const user = rt.session.user;
    if (user.status === 'DEACTIVATED' || user.status === 'BLOCKED') throw new AppError('AUTH_ACCOUNT_DEACTIVATED', 'This account is not active.');

    const newRaw = await this.issueRefresh(rt.sessionId, rt.familyId, rt.id);
    await this.prisma.client.session.update({ where: { id: rt.sessionId }, data: { lastSeenAt: new Date() } });
    const accessMinutes = this.config.getInt('auth.accessTokenMinutes') ?? 15;
    const accessToken = this.tokens.signAccess({ sub: user.id, sid: rt.sessionId, role: user.role }, accessMinutes);
    const actor = await this.buildActor(user.id, rt.sessionId);
    return { accessToken, refreshToken: newRaw, accessExpiresInSec: accessMinutes * 60, user: await this.users.toSummary(user), gates: await this.gates.compute(actor, ip), permissions: [...actor.permissions] };
  }

  async logout(sessionId: string, all: boolean, userId: string) {
    await this.prisma.client.session.updateMany({ where: all ? { userId, revokedAt: null } : { id: sessionId }, data: { revokedAt: new Date(), revokedReason: all ? 'LOGOUT_ALL' : 'LOGOUT' } });
  }

  async me(actor: Actor, ip: string): Promise<{ user: unknown; gates: Gates; permissions: string[] }> {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: actor.userId } });
    return { user: await this.users.toSummary(user), gates: await this.gates.compute(actor, ip), permissions: [...actor.permissions] };
  }

  /** Builds the Actor for guards/scoping from a verified access token (F-102). */
  async buildActor(userId: string, sessionId: string): Promise<Actor> {
    const [user, session] = await Promise.all([
      this.prisma.client.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } }),
      this.prisma.client.session.findUnique({ where: { id: sessionId }, select: { revokedAt: true } }),
    ]);
    if (!user || !session || session.revokedAt) throw new AppError('AUTH_SESSION_REVOKED', 'Session is no longer valid.', undefined, 'LOGIN_AGAIN');
    const role = user.role as Role;
    const [teamUserIds, reportingParentUserId] = await Promise.all([
      role === 'MANAGER' ? this.hierarchy.teamUserIds(user.id) : Promise.resolve([]),
      this.hierarchy.currentParentId(user.id),
    ]);
    return { userId: user.id, role, status: user.status, sessionId, permissions: ROLE_PERMISSIONS[role], teamUserIds, reportingParentUserId };
  }

  private async issueRefresh(sessionId: string, familyId: string | null, replacesId?: string): Promise<string> {
    const raw = this.crypto.randomToken();
    const days = this.config.getInt('auth.refreshTokenDays') ?? 30;
    const created = await this.prisma.client.refreshToken.create({
      data: { sessionId, tokenHash: this.crypto.hashToken(raw), familyId: familyId ?? sessionId, expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    if (replacesId) await this.prisma.client.refreshToken.update({ where: { id: replacesId }, data: { usedAt: new Date(), replacedById: created.id } });
    return raw;
  }

  private lockKey(mobile: string) {
    return `otp:lock:${mobile}`;
  }
  private async isLocked(mobile: string): Promise<boolean> {
    const lock = await this.prisma.client.otpChallenge.findFirst({
      where: { mobile, attempts: { gte: this.config.getInt('auth.otp.maxAttempts') ?? 5 }, createdAt: { gte: new Date(Date.now() - (this.config.getInt('auth.otp.lockMinutes') ?? 15) * 60_000) } },
      select: { id: true },
    });
    return Boolean(lock);
  }
  private async lock(_mobile: string): Promise<void> {
    // Lock state is derived from the attempts counter + lockMinutes window (see isLocked); nothing extra to persist.
  }
}
