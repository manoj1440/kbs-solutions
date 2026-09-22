import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { HierarchyService } from '../users/hierarchy.service';

import { TrainingContentService } from './training-content.service';

/** F-205: training progress for Manager (own team) and Admin (all, filter by Manager). */
@Injectable()
export class TrainingTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: HierarchyService,
    private readonly config: ConfigService,
    private readonly content: TrainingContentService,
  ) {}

  private async scopeIds(actor: Actor, managerId?: string): Promise<string[] | null> {
    if (actor.role === 'MANAGER') return actor.teamUserIds;
    if (actor.role === 'ADMIN') return managerId ? this.hierarchy.teamUserIds(managerId) : null;
    throw new AppError('RBAC_FORBIDDEN', 'Not allowed.');
  }

  async team(actor: Actor, managerId?: string) {
    const ids = await this.scopeIds(actor, managerId);
    const enrollments = await this.prisma.client.trainingEnrollment.findMany({
      where: { ...(ids ? { telecallerUserId: { in: ids } } : {}), telecaller: { role: 'TELECALLER' } },
      include: { telecaller: { select: { id: true, fullName: true, employeeCode: true, status: true, lastLoginAt: true } }, moduleResults: { include: { module: { select: { sequence: true } } } }, reactivations: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const now = Date.now();
    const rows = enrollments.map((e) => {
      const deadlinePassed = e.status !== 'PASSED' && e.deadlineAt !== null && e.deadlineAt.getTime() < now;
      return {
        telecaller: e.telecaller,
        status: deadlinePassed && e.status !== 'EXPIRED_DEACTIVATED' ? 'EXPIRED_DEACTIVATED' : e.status,
        firstLoginAt: e.firstLoginAt?.toISOString() ?? null,
        deadlineAt: e.deadlineAt?.toISOString() ?? null,
        remainingMs: e.deadlineAt && !deadlinePassed && e.status !== 'PASSED' ? e.deadlineAt.getTime() - now : null,
        currentModuleSequence: e.currentModuleSequence,
        modules: [...e.moduleResults].sort((a, b) => a.module.sequence - b.module.sequence).map((r) => ({ sequence: r.module.sequence, status: r.status, bestScorePct: r.bestScorePct, attemptCount: r.attemptCount })),
        reactivations: e.reactivations.length,
      };
    });
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const passRate = [1, 2, 3].map((seq) => {
      const results = rows.map((r) => r.modules.find((m) => m.sequence === seq)).filter(Boolean) as Array<{ status: string }>;
      const reached = results.filter((m) => m.status !== 'LOCKED').length;
      return { sequence: seq, reached, passed: results.filter((m) => m.status === 'PASSED').length };
    });
    return { __envelope: true as const, data: rows, meta: { population: rows.length, byStatus, passRate, asOf: new Date().toISOString() } };
  }

  async detail(actor: Actor, telecallerUserId: string) {
    if (actor.role === 'MANAGER' && !actor.teamUserIds.includes(telecallerUserId)) throw AppError.notFound('Telecaller');
    if (actor.role !== 'MANAGER' && actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Not allowed.');
    const existing = await this.prisma.client.trainingEnrollment.findUnique({ where: { telecallerUserId }, select: { id: true } });
    if (existing) await this.content.ensureResults(existing.id);
    const e = await this.prisma.client.trainingEnrollment.findUnique({
      where: { telecallerUserId },
      include: {
        telecaller: { select: { id: true, fullName: true, employeeCode: true, status: true, mobile: false, lastLoginAt: true } },
        moduleResults: { include: { module: { select: { sequence: true, title: true, passThresholdPct: true } }, attempts: { orderBy: { startedAt: 'desc' }, select: { id: true, startedAt: true, submittedAt: true, scorePct: true, passed: true, moduleVersion: true } } } },
        reactivations: { orderBy: { at: 'desc' }, include: { byManager: { select: { id: true, fullName: true } } } },
      },
    });
    if (!e) throw AppError.notFound('Telecaller');
    const deadlinePassed = e.status !== 'PASSED' && e.deadlineAt !== null && e.deadlineAt.getTime() < Date.now();
    return {
      telecaller: e.telecaller,
      status: deadlinePassed && e.status !== 'EXPIRED_DEACTIVATED' ? 'EXPIRED_DEACTIVATED' : e.status,
      firstLoginAt: e.firstLoginAt?.toISOString() ?? null,
      deadlineAt: e.deadlineAt?.toISOString() ?? null,
      deadlinePassed,
      currentModuleSequence: e.currentModuleSequence,
      canReactivate: actor.role === 'MANAGER' && (e.status === 'EXPIRED_DEACTIVATED' || deadlinePassed) && e.status !== 'PASSED',
      reactivationWindowHours: this.config.getInt('training.reactivationWindowHours'),
      modules: [...e.moduleResults]
        .sort((a, b) => a.module.sequence - b.module.sequence)
        .map((r) => ({ sequence: r.module.sequence, title: r.module.title, passThresholdPct: r.module.passThresholdPct, status: r.status, bestScorePct: r.bestScorePct, attemptCount: r.attemptCount, videoCompletedAt: r.videoCompletedAt?.toISOString() ?? null, passedAt: r.passedAt?.toISOString() ?? null, attempts: r.attempts })),
      reactivations: e.reactivations.map((r) => ({ id: r.id, at: r.at.toISOString(), byManager: r.byManager, reason: r.reason, originalDeadlineAt: r.originalDeadlineAt?.toISOString() ?? null, newDeadlineAt: r.newDeadlineAt?.toISOString() ?? null, resumedAtModuleSequence: r.resumedAtModuleSequence })),
    };
  }
}
