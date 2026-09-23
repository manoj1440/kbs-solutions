import type { NotificationKind, NotificationListQuery, RegisterPushDeviceBody } from '@kbs/shared';
import { scrubSensitiveText } from '@kbs/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PUSH_PROVIDER, type PushProvider } from '../../providers/ports';

export interface NotifyInput {
  recipientUserId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  deepLink?: { entityType: string; entityId: string };
  sourceRef?: Record<string, unknown>;
  /** Unique per logical event so repeated processing never duplicates (REQ-19 §19.2). */
  dedupeKey: string;
}

/**
 * F-701 notification centre: in-app rows (deduplicated by `dedupeKey`), best-effort push to the recipient's registered
 * devices, read state, and scope re-check before a deep link is followed. Titles/bodies are scrubbed of PAN, long
 * digit runs and mobiles before they are stored or pushed (REQ-21 §21.1, NOTIF-02).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const title = scrubSensitiveText(input.title);
    const body = scrubSensitiveText(input.body);
    const created = await this.prisma.client.notification.createManyAndReturn({
      data: [{ recipientUserId: input.recipientUserId, kind: input.kind, title, body, deepLink: input.deepLink, sourceRef: input.sourceRef as object | undefined, dedupeKey: input.dedupeKey }],
      skipDuplicates: true,
      select: { id: true },
    });
    if (!created.length) return; // identical event already delivered — no second push either
    await this.pushTo(input.recipientUserId, created[0].id, title, body, input.deepLink);
  }

  /** Several recipients, one dedupe key per recipient; a user listed twice (e.g. Admin who is also the actor) gets one row. */
  async notifyMany(recipients: (string | null | undefined)[], input: Omit<NotifyInput, 'recipientUserId' | 'dedupeKey'> & { dedupeKey: string }) {
    for (const r of [...new Set(recipients.filter((x): x is string => Boolean(x)))]) await this.notify({ ...input, recipientUserId: r, dedupeKey: `${input.dedupeKey}:${r}` });
  }

  private async pushTo(userId: string, notificationId: string, title: string, body: string, deepLink?: { entityType: string; entityId: string }) {
    try {
      const devices = await this.prisma.client.pushDevice.findMany({ where: { userId, revokedAt: null }, select: { token: true } });
      if (!devices.length) return;
      let any = false;
      for (const d of devices) {
        const r = await this.push.send({ token: d.token, title, body, data: { notificationId, ...(deepLink ? { entityType: deepLink.entityType, entityId: deepLink.entityId } : {}) } });
        any = any || r.accepted;
      }
      if (any) await this.prisma.client.notification.update({ where: { id: notificationId }, data: { pushedAt: new Date() } });
    } catch (e) {
      this.logger.warn({ notificationId, err: (e as Error).message }, 'push delivery failed (in-app row kept)');
    }
  }

  async list(actor: Actor, q: NotificationListQuery) {
    const where = { recipientUserId: actor.userId, ...(q.unreadOnly ? { readAt: null } : {}) };
    const [rows, total, unread] = await Promise.all([
      this.prisma.client.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.client.notification.count({ where }),
      this.prisma.client.notification.count({ where: { recipientUserId: actor.userId, readAt: null } }),
    ]);
    return new Paginated(rows, q.page, q.pageSize, total, { unread });
  }

  async unreadCount(actor: Actor) {
    return { unread: await this.prisma.client.notification.count({ where: { recipientUserId: actor.userId, readAt: null } }) };
  }

  async markRead(actor: Actor, id: string) {
    const n = await this.prisma.client.notification.findUnique({ where: { id } });
    if (!n || n.recipientUserId !== actor.userId) throw AppError.notFound('Notification');
    if (!n.readAt) await this.prisma.client.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { id, readAt: n.readAt ?? new Date() };
  }

  async markAllRead(actor: Actor) {
    const r = await this.prisma.client.notification.updateMany({ where: { recipientUserId: actor.userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }

  /**
   * Deep link with re-check (REQ-19 §19.2): marks read, then verifies the actor can still see the target *now*
   * (ownership may have changed since the notification was sent). Not visible → NOT_FOUND, never the content.
   */
  async target(actor: Actor, id: string) {
    const n = await this.prisma.client.notification.findUnique({ where: { id } });
    if (!n || n.recipientUserId !== actor.userId) throw AppError.notFound('Notification');
    if (!n.readAt) await this.prisma.client.notification.update({ where: { id }, data: { readAt: new Date() } });
    const link = n.deepLink as { entityType?: string; entityId?: string } | null;
    if (!link?.entityType || !link.entityId) return { entityType: null, entityId: null };
    if (!(await this.canSee(actor, link.entityType, link.entityId))) throw AppError.notFound(link.entityType);
    return { entityType: link.entityType, entityId: link.entityId };
  }

  private async canSee(actor: Actor, entityType: string, entityId: string): Promise<boolean> {
    if (actor.role === 'ADMIN') return true;
    switch (entityType) {
      case 'Lead': {
        const l = await this.prisma.client.lead.findUnique({ where: { id: entityId }, select: { advisorUserId: true } });
        if (!l) return false;
        return l.advisorUserId === actor.userId || (actor.role === 'MANAGER' && actor.teamUserIds.includes(l.advisorUserId));
      }
      case 'PayoutRequest': {
        const r = await this.prisma.client.payoutRequest.findUnique({ where: { id: entityId }, select: { advisorUserId: true, managerApproverUserId: true, state: true } });
        if (!r) return false;
        if (actor.role === 'ACCOUNTS') return ['APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'ON_HOLD'].includes(r.state);
        return r.advisorUserId === actor.userId || r.managerApproverUserId === actor.userId || (actor.role === 'MANAGER' && actor.teamUserIds.includes(r.advisorUserId));
      }
      case 'MisImportBatch':
        return false; // Admin only
      case 'User':
        return entityId === actor.userId || (actor.role === 'MANAGER' && actor.teamUserIds.includes(entityId));
      case 'CallingRecord': {
        const c = await this.prisma.client.callingRecord.findUnique({ where: { id: entityId }, select: { assignedTelecallerUserId: true } });
        if (!c) return false;
        return c.assignedTelecallerUserId === actor.userId || (actor.role === 'MANAGER' && c.assignedTelecallerUserId !== null && actor.teamUserIds.includes(c.assignedTelecallerUserId));
      }
      default:
        // other entity types are re-checked by their own read endpoints (which 404 out-of-scope ids)
        return true;
    }
  }

  // ── recipient resolution (REQ-19 §19.1 — current hierarchy, ownership-scoped) ──
  /** Owning Advisor, their current Manager (if the parent is a Manager) and the Admin. */
  async leadAudience(leadId: string): Promise<{ advisorUserId: string; managerUserId: string | null; adminUserId: string | null }> {
    const lead = await this.prisma.client.lead.findUniqueOrThrow({ where: { id: leadId }, select: { advisorUserId: true } });
    return { advisorUserId: lead.advisorUserId, ...(await this.chainOf(lead.advisorUserId)) };
  }

  /** Current Manager (if any) and Admin above a user. */
  async chainOf(userId: string): Promise<{ managerUserId: string | null; adminUserId: string | null }> {
    const parent = await this.prisma.client.reportingAssignment.findFirst({ where: { childUserId: userId, effectiveTo: null, status: 'ACTIVE' }, select: { parent: { select: { id: true, role: true } } } });
    const admin = await this.prisma.client.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    return { managerUserId: parent?.parent.role === 'MANAGER' ? parent.parent.id : null, adminUserId: admin?.id ?? null };
  }

  // ── push devices ──
  async registerDevice(actor: Actor, body: RegisterPushDeviceBody) {
    const d = await this.prisma.client.pushDevice.upsert({
      where: { token: body.token },
      create: { userId: actor.userId, sessionId: actor.sessionId, token: body.token, platform: body.platform },
      // a token moving to another user (shared phone, new login) is re-bound; the old owner stops receiving pushes
      update: { userId: actor.userId, sessionId: actor.sessionId, platform: body.platform, revokedAt: null, lastSeenAt: new Date() },
    });
    return { id: d.id, platform: d.platform, registeredAt: d.createdAt.toISOString() };
  }

  async unregisterDevice(actor: Actor, token: string) {
    const r = await this.prisma.client.pushDevice.updateMany({ where: { token, userId: actor.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { revoked: r.count };
  }

  /** Called on logout / session revoke so a signed-out phone stops receiving pushes. */
  async revokeDevicesForSessions(where: { sessionId?: string; userId?: string }) {
    await this.prisma.client.pushDevice.updateMany({ where: { ...where, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
