import { Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { reissueIdCard } from '../id-cards/reissue';
import { NotificationsService } from '../notifications/notifications.service';
import { HierarchyService } from '../users/hierarchy.service';

/**
 * F-204: deadline expiry (job + on-demand) and Manager reactivation (REQ-05 §5.4).
 * The gate itself is lazy (F-111); this service only materialises the deactivation and notifies.
 */
@Injectable()
export class TrainingExpiryService {
  private readonly logger = new Logger(TrainingExpiryService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
    private readonly audit: AuditService,
  ) {}

  /** Deactivates every Telecaller whose window has elapsed without passing all modules. Idempotent. */
  async sweep(): Promise<{ expired: number }> {
    const due = await this.prisma.client.trainingEnrollment.findMany({
      where: { status: { in: ['IN_PROGRESS', 'REACTIVATED_IN_PROGRESS'] }, deadlineAt: { lt: new Date() } },
      select: { id: true, telecallerUserId: true, deadlineAt: true },
    });
    let expired = 0;
    for (const e of due) {
      try {
        await this.expire(e);
        expired++;
      } catch (err) {
        this.logger.warn({ enrollmentId: e.id, err: (err as Error).message }, 'expiry failed');
      }
    }
    return { expired };
  }

  private async expire(e: { id: string; telecallerUserId: string; deadlineAt: Date | null }) {
    await this.prisma.client.$transaction(async (tx) => {
      const fresh = await tx.trainingEnrollment.findUniqueOrThrow({ where: { id: e.id } });
      if (fresh.status !== 'IN_PROGRESS' && fresh.status !== 'REACTIVATED_IN_PROGRESS') return;
      await tx.trainingEnrollment.update({ where: { id: e.id }, data: { status: 'EXPIRED_DEACTIVATED' } });
      await tx.user.update({ where: { id: e.telecallerUserId }, data: { status: 'DEACTIVATED' } });
      await tx.userLifecycleEvent.create({ data: { userId: e.telecallerUserId, eventType: 'DEACTIVATED', reason: 'TRAINING_DEADLINE', metadata: { deadlineAt: e.deadlineAt?.toISOString() } } });
      await tx.session.updateMany({ where: { userId: e.telecallerUserId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'TRAINING_DEADLINE' } });
      await tx.officialIdCard.updateMany({ where: { userId: e.telecallerUserId, revokedAt: null }, data: { revokedAt: new Date() } }); // F-312
    });
    await this.audit.record({ action: 'training.expire', entityType: 'User', entityId: e.telecallerUserId, actor: { userId: null, role: null }, metadata: { enrollmentId: e.id, deadlineAt: e.deadlineAt?.toISOString() } });
    const managerId = await this.hierarchy.currentParentId(e.telecallerUserId);
    await this.notifications.notify({
      recipientUserId: e.telecallerUserId,
      kind: 'TRAINING_DEACTIVATED',
      title: 'Training window ended',
      body: 'Your 72-hour training window has ended and your account is deactivated. Contact your Manager to reactivate training.',
      dedupeKey: `training.expired:${e.id}:${e.deadlineAt?.toISOString() ?? 'none'}`,
    });
    if (managerId) {
      await this.notifications.notify({
        recipientUserId: managerId,
        kind: 'TRAINING_DEACTIVATED',
        title: 'Telecaller deactivated — training deadline',
        body: 'A Telecaller on your team did not finish training within the window. You can reactivate them from their profile.',
        deepLink: { entityType: 'User', entityId: e.telecallerUserId },
        dedupeKey: `training.expired.mgr:${e.id}:${e.deadlineAt?.toISOString() ?? 'none'}`,
      });
    }
  }

  /** Manager reactivation: resume at the first module not passed; new window from config (null → gate stays closed). */
  async reactivate(actor: Actor, telecallerUserId: string, reason: string) {
    if (actor.role !== 'MANAGER' || !actor.teamUserIds.includes(telecallerUserId)) throw AppError.notFound('Telecaller');
    const enrollment = await this.prisma.client.trainingEnrollment.findUnique({ where: { telecallerUserId }, include: { moduleResults: { include: { module: true } } } });
    if (!enrollment) throw AppError.notFound('Telecaller');
    const deadlinePassed = enrollment.deadlineAt !== null && enrollment.deadlineAt.getTime() < Date.now();
    if (enrollment.status !== 'EXPIRED_DEACTIVATED' && !deadlinePassed) throw new AppError('CONFLICT', 'This Telecaller is not deactivated by the training deadline.');
    if (enrollment.status === 'PASSED') throw new AppError('CONFLICT', 'Training is already passed.');
    const firstUnpassed = enrollment.moduleResults.filter((r) => r.status !== 'PASSED').map((r) => r.module.sequence).sort((a, b) => a - b)[0] ?? 1;
    const windowHours = this.config.getInt('training.reactivationWindowHours');
    const newDeadlineAt = windowHours === null ? null : new Date(Date.now() + windowHours * 3_600_000);
    const result = await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({ where: { id: telecallerUserId }, data: { status: 'ACTIVE' } });
      await reissueIdCard(tx, telecallerUserId); // F-312: fresh card version after reactivation
      await tx.userLifecycleEvent.create({ data: { userId: telecallerUserId, eventType: 'REACTIVATED', actorUserId: actor.userId, reason } });
      const r = await tx.trainingReactivation.create({
        data: { enrollmentId: enrollment.id, byManagerUserId: actor.userId, reason, originalDeadlineAt: enrollment.deadlineAt, newDeadlineAt, resumedAtModuleSequence: firstUnpassed },
      });
      await tx.trainingEnrollment.update({ where: { id: enrollment.id }, data: { status: 'REACTIVATED_IN_PROGRESS', deadlineAt: newDeadlineAt, currentModuleSequence: firstUnpassed } });
      // unlock the resumed module (it may still be LOCKED if the Telecaller never reached it)
      const resumed = enrollment.moduleResults.find((m) => m.module.sequence === firstUnpassed);
      if (resumed && resumed.status === 'LOCKED') await tx.trainingModuleResult.update({ where: { id: resumed.id }, data: { status: 'IN_PROGRESS' } });
      return r;
    });
    RequestContextStore.audit({ entityId: telecallerUserId, before: { status: enrollment.status, deadlineAt: enrollment.deadlineAt }, after: { status: 'REACTIVATED_IN_PROGRESS', newDeadlineAt, resumedAtModuleSequence: firstUnpassed }, reason });
    await this.notifications.notify({
      recipientUserId: telecallerUserId,
      kind: 'TRAINING_REACTIVATED',
      title: 'Training reactivated',
      body: newDeadlineAt ? `Your Manager reactivated your training. Resume at Module ${firstUnpassed}.` : `Your Manager reactivated your training (Module ${firstUnpassed}). The new window is not configured yet — contact the Admin.`,
      dedupeKey: `training.reactivated:${result.id}`,
    });
    return { reactivationId: result.id, resumedAtModuleSequence: firstUnpassed, newDeadlineAt: newDeadlineAt?.toISOString() ?? null, windowConfigured: windowHours !== null };
  }
}
