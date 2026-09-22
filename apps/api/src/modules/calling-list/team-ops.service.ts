import { maskMobile, recordingChip } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * F-313: Manager/Admin operational evidence views — counts with denominators, no scores or rankings (REQ-15 §15.3).
 * "Connected" is provider-confirmed only (CallAttempt.connectedAt), never derived from outcomes (REQ-16 §16.3).
 */
@Injectable()
export class TeamOpsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(actor: Actor): string[] | null {
    if (actor.role === 'ADMIN') return null;
    if (actor.role === 'MANAGER') return actor.teamUserIds;
    throw new AppError('RBAC_FORBIDDEN', 'Team views are for Managers and the Admin.');
  }

  private assertInScope(actor: Actor, telecallerUserId: string) {
    const ids = this.scope(actor);
    if (ids && !ids.includes(telecallerUserId)) throw AppError.notFound('Telecaller');
  }

  async overview(actor: Actor, range: DateRange) {
    const ids = this.scope(actor);
    const now = new Date();
    const users = await this.prisma.client.user.findMany({
      where: { role: 'TELECALLER', ...(ids ? { id: { in: ids } } : {}) },
      select: { id: true, fullName: true, employeeCode: true, status: true, lastLoginAt: true, trainingEnrollment: { select: { status: true, deadlineAt: true } }, wfhExceptions: { where: { revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, select: { id: true, endsAt: true }, take: 1 } },
      orderBy: { fullName: 'asc' },
    });
    const uids = users.map((u) => u.id);
    if (!uids.length) return { range: { from: range.from.toISOString(), to: range.to.toISOString() }, telecallers: [] };
    const inRange = { gte: range.from, lte: range.to };
    const [queue, dueNow, attempts, connected, outcomes, shares, interests] = await Promise.all([
      this.prisma.client.callingRecord.groupBy({ by: ['assignedTelecallerUserId'], where: { assignedTelecallerUserId: { in: uids }, hiddenAt: null, suppressed: false }, _count: { _all: true } }),
      this.prisma.client.callingRecord.groupBy({ by: ['assignedTelecallerUserId'], where: { assignedTelecallerUserId: { in: uids }, hiddenAt: null, nextFollowUpAt: { lte: now } }, _count: { _all: true } }),
      this.prisma.client.callAttempt.groupBy({ by: ['telecallerUserId'], where: { telecallerUserId: { in: uids }, initiatedAt: inRange }, _count: { _all: true } }),
      this.prisma.client.callAttempt.groupBy({ by: ['telecallerUserId'], where: { telecallerUserId: { in: uids }, initiatedAt: inRange, connectedAt: { not: null } }, _count: { _all: true }, _sum: { durationSec: true } }),
      this.prisma.client.callOutcome.groupBy({ by: ['telecallerUserId', 'outcome'], where: { telecallerUserId: { in: uids }, at: inRange }, _count: { _all: true } }),
      this.prisma.client.shareAction.groupBy({ by: ['actorUserId', 'kind'], where: { actorUserId: { in: uids }, at: inRange }, _count: { _all: true } }),
      this.prisma.client.callingInterest.groupBy({ by: ['telecallerUserId'], where: { telecallerUserId: { in: uids }, at: inRange }, _count: { _all: true } }),
    ]);
    const m = <T extends { _count: { _all: number } }>(rows: T[], key: (r: T) => string | null) => new Map(rows.map((r) => [key(r) as string, r._count._all]));
    const queueMap = m(queue, (r) => r.assignedTelecallerUserId);
    const dueMap = m(dueNow, (r) => r.assignedTelecallerUserId);
    const attemptsMap = m(attempts, (r) => r.telecallerUserId);
    const connectedMap = new Map(connected.map((r) => [r.telecallerUserId, { n: r._count._all, talkSec: r._sum.durationSec ?? 0 }]));
    const interestMap = m(interests, (r) => r.telecallerUserId);
    const outcomesMap = new Map<string, Record<string, number>>();
    for (const o of outcomes) outcomesMap.set(o.telecallerUserId, { ...(outcomesMap.get(o.telecallerUserId) ?? {}), [o.outcome]: o._count._all });
    const sharesMap = new Map<string, Record<string, number>>();
    for (const s of shares) sharesMap.set(s.actorUserId, { ...(sharesMap.get(s.actorUserId) ?? {}), [s.kind]: s._count._all });
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      telecallers: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        employeeCode: u.employeeCode,
        status: u.status,
        training: u.trainingEnrollment?.status ?? 'NOT_STARTED',
        wfhActive: u.wfhExceptions.length > 0,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        queueSize: queueMap.get(u.id) ?? 0,
        followUpsDue: dueMap.get(u.id) ?? 0,
        attempts: attemptsMap.get(u.id) ?? 0,
        connected: connectedMap.get(u.id)?.n ?? 0,
        talkTimeSec: connectedMap.get(u.id)?.talkSec ?? 0,
        outcomes: outcomesMap.get(u.id) ?? {},
        shares: sharesMap.get(u.id) ?? {},
        interests: interestMap.get(u.id) ?? 0,
      })),
    };
  }

  /** Drill-down: evidence lists for one Telecaller in a range (attempts w/ recording chip, outcomes, shares, remarks, allocation events, follow-ups due). */
  async activity(actor: Actor, telecallerUserId: string, range: DateRange) {
    this.assertInScope(actor, telecallerUserId);
    const u = await this.prisma.client.user.findUnique({ where: { id: telecallerUserId }, select: { id: true, fullName: true, employeeCode: true, status: true, role: true } });
    if (!u || u.role !== 'TELECALLER') throw AppError.notFound('Telecaller');
    const inRange = { gte: range.from, lte: range.to };
    const now = new Date();
    const [attempts, outcomes, shares, remarks, allocations, followUps, queueSize] = await Promise.all([
      this.prisma.client.callAttempt.findMany({ where: { telecallerUserId, initiatedAt: inRange }, orderBy: { initiatedAt: 'desc' }, take: 200, include: { recording: { select: { status: true, durationSec: true } }, callingRecord: { select: { id: true, fullName: true, mobile: true } } } }),
      this.prisma.client.callOutcome.findMany({ where: { telecallerUserId, at: inRange }, orderBy: { at: 'desc' }, take: 200, include: { callingRecord: { select: { id: true, fullName: true } }, selectedCard: { select: { name: true } } } }),
      this.prisma.client.shareAction.findMany({ where: { actorUserId: telecallerUserId, at: inRange }, orderBy: { at: 'desc' }, take: 200, include: { callingRecord: { select: { id: true, fullName: true } }, card: { select: { name: true } } } }),
      this.prisma.client.operationalRemark.findMany({ where: { authorUserId: telecallerUserId, at: inRange, entityType: 'CallingRecord' }, orderBy: { at: 'desc' }, take: 100 }),
      this.prisma.client.allocationEvent.findMany({ where: { OR: [{ toTelecallerUserId: telecallerUserId }, { fromTelecallerUserId: telecallerUserId }], at: inRange }, orderBy: { at: 'desc' }, take: 200, include: { callingRecord: { select: { id: true, fullName: true } } } }),
      this.prisma.client.callingRecord.findMany({ where: { assignedTelecallerUserId: telecallerUserId, hiddenAt: null, nextFollowUpAt: { not: null } }, orderBy: { nextFollowUpAt: 'asc' }, take: 100, select: { id: true, fullName: true, mobile: true, nextFollowUpAt: true, interactionStatus: true } }),
      this.prisma.client.callingRecord.count({ where: { assignedTelecallerUserId: telecallerUserId, hiddenAt: null, suppressed: false } }),
    ]);
    return {
      telecaller: u,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      queueSize,
      attempts: attempts.map((a) => ({ id: a.id, at: a.initiatedAt.toISOString(), customer: { id: a.callingRecord.id, fullName: a.callingRecord.fullName, mobileMasked: maskMobile(a.callingRecord.mobile) }, providerState: a.providerState, connectedAt: a.connectedAt?.toISOString() ?? null, durationSec: a.durationSec, failureReason: a.failureReason, recording: recordingChip(a.recording?.status), recordingStatus: a.recording?.status ?? null, canPlay: a.recording?.status === 'AVAILABLE' })),
      outcomes: outcomes.map((o) => ({ id: o.id, at: o.at.toISOString(), customer: o.callingRecord, outcome: o.outcome, remarks: o.remarks, followUpAt: o.followUpAt?.toISOString() ?? null, card: o.selectedCard?.name ?? null, doNotContact: o.doNotContact })),
      shares: shares.map((s) => ({ id: s.id, at: s.at.toISOString(), customer: s.callingRecord, kind: s.kind, card: s.card?.name ?? null, channel: s.channel, handoffResult: s.handoffResult, deliveryStatus: s.deliveryStatus, targetMobileMasked: s.targetMobileMasked })),
      remarks: remarks.map((r) => ({ id: r.id, at: r.at.toISOString(), callingRecordId: r.entityId, text: r.text, editedAt: r.editedAt?.toISOString() ?? null })),
      allocations: allocations.map((e) => ({ id: e.id, at: e.at.toISOString(), customer: e.callingRecord, direction: e.toTelecallerUserId === telecallerUserId ? 'IN' : 'OUT', reason: e.reason })),
      followUps: followUps.map((f) => ({ id: f.id, fullName: f.fullName, mobileMasked: maskMobile(f.mobile), dueAt: f.nextFollowUpAt?.toISOString() ?? null, overdue: (f.nextFollowUpAt?.getTime() ?? 0) <= now.getTime(), interactionStatus: f.interactionStatus })),
    };
  }
}
