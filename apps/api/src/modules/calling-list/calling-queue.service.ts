import { type CallingQueueRow, type CallingRecordsSummary, maskMobile, type QueueQuery, RECORD_STATUSES, type RecordStatus, recordStatusOf } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Interaction statuses that keep a record in the active queue (REQ-06 §6.5). */
const ACTIVE_STATUSES = ['UNTOUCHED', 'FOLLOW_UP', 'INTERESTED', 'LINK_SHARED', 'UNREACHABLE'] as const;

/**
 * F-307: calling queue + record detail with role scoping (RBAC-01):
 * Telecaller → own rows only; Manager → team; Admin → all. Mobile numbers are always masked in lists and details;
 * the full number only ever reaches the telephony provider at call time (F-309).
 */
@Injectable()
export class CallingQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /** Which Telecaller ids the actor may see; `null` = unrestricted (Admin). */
  private scope(actor: Actor, telecallerId?: string): string[] | null {
    if (actor.role === 'TELECALLER') {
      if (telecallerId && telecallerId !== actor.userId) throw new AppError('RBAC_FORBIDDEN', 'You can only view your own queue.');
      return [actor.userId];
    }
    if (actor.role === 'MANAGER') {
      if (telecallerId) {
        if (!actor.teamUserIds.includes(telecallerId)) throw new AppError('RBAC_FORBIDDEN', 'That Telecaller is not in your team.');
        return [telecallerId];
      }
      return actor.teamUserIds;
    }
    return telecallerId ? [telecallerId] : null;
  }

  private tabWhere(tab: QueueQuery['tab']) {
    if (tab === 'hidden') return { hiddenAt: { not: null } };
    if (tab === 'followups') return { hiddenAt: null, nextFollowUpAt: { not: null } };
    return { hiddenAt: null, suppressed: false, interactionStatus: { in: [...ACTIVE_STATUSES] } };
  }

  /** F-808: Prisma filter for one derived status — the same precedence as `recordStatusOf`. */
  private statusWhere(status: RecordStatus) {
    if (status === 'EXCLUDED' || status === 'NEEDS_REVIEW') return { reviewStatus: status };
    const accepted = { reviewStatus: 'ACCEPTED' as const };
    if (status === 'DO_NOT_CONTACT') return { ...accepted, suppressed: true };
    if (status === 'UNASSIGNED') return { ...accepted, suppressed: false, assignedTelecallerUserId: null };
    return { ...accepted, suppressed: false, assignedTelecallerUserId: { not: null }, interactionStatus: status };
  }

  private scopeWhere(ids: string[] | null) {
    return ids ? { assignedTelecallerUserId: { in: ids } } : {};
  }

  async list(actor: Actor, q: QueueQuery) {
    const ids = this.scope(actor, q.telecallerId);
    const statusWhere = q.status ? this.statusWhere(q.status) : this.tabWhere(q.tab);
    const where = {
      AND: [this.scopeWhere(ids), statusWhere],
      ...(q.pincode ? { pincode: { startsWith: q.pincode } } : {}),
      ...(q.search ? { OR: [{ fullName: { contains: q.search, mode: 'insensitive' as const } }, { pincode: { startsWith: q.search } }, { resolvedCity: { contains: q.search, mode: 'insensitive' as const } }] } : {}),
    };
    const orderBy = q.status ? [{ updatedAt: 'desc' as const }, { sourceRowNumber: 'asc' as const }] : q.tab === 'followups' ? [{ nextFollowUpAt: 'asc' as const }] : q.tab === 'hidden' ? [{ hiddenAt: 'desc' as const }] : [{ nextFollowUpAt: { sort: 'asc' as const, nulls: 'last' as const } }, { assignedAt: 'asc' as const }, { sourceRowNumber: 'asc' as const }];
    const [rows, total] = await Promise.all([
      this.prisma.client.callingRecord.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { assignedTelecaller: { select: { id: true, fullName: true } }, batch: { select: { publicRef: true } }, outcomes: { orderBy: { at: 'desc' }, take: 1, select: { outcome: true, at: true, remarks: true } } },
      }),
      this.prisma.client.callingRecord.count({ where }),
    ]);
    const counts = actor.role === 'TELECALLER' && !q.search ? await this.counts(actor.userId) : undefined;
    return new Paginated(rows.map(toRow), q.page, q.pageSize, total, counts ? { counts } : {});
  }

  /** F-808: system-wide (Admin) or team (Manager) record counts; statuses are exclusive so they sum to `total`. */
  async summary(actor: Actor): Promise<CallingRecordsSummary> {
    const scope = this.scopeWhere(this.scope(actor));
    const count = (where: object) => this.prisma.client.callingRecord.count({ where: { AND: [scope, where] } });
    const [total, statusCounts, attempted, connected, followUpsDue, batches, needingAction] = await Promise.all([
      count({}),
      Promise.all(RECORD_STATUSES.map((s) => count(this.statusWhere(s)))),
      count({ callAttempts: { some: {} } }),
      count({ callAttempts: { some: { connectedAt: { not: null } } } }),
      count({ hiddenAt: null, suppressed: false, nextFollowUpAt: { lte: new Date() } }),
      actor.role === 'ADMIN' ? this.prisma.client.customerImportBatch.count() : 0,
      // batches an Admin still has to act on: mapping/validation not finished, or imported but never allocated
      actor.role === 'ADMIN' ? this.prisma.client.customerImportBatch.count({ where: { OR: [{ status: { in: ['UPLOADED', 'VALIDATED'] } }, { status: 'IMPORTED', allocatedAt: null }] } }) : 0,
    ]);
    return {
      total,
      byStatus: Object.fromEntries(RECORD_STATUSES.map((s, i) => [s, statusCounts[i]])) as Record<RecordStatus, number>,
      attempted,
      connected,
      followUpsDue,
      batches: { total: batches, needingAction },
      asOf: new Date().toISOString(),
    };
  }

  /** Tab badges for the Telecaller home. */
  async counts(telecallerUserId: string) {
    const base = { assignedTelecallerUserId: telecallerUserId };
    const [active, followups, dueNow, hidden] = await Promise.all([
      this.prisma.client.callingRecord.count({ where: { ...base, ...this.tabWhere('active') } }),
      this.prisma.client.callingRecord.count({ where: { ...base, ...this.tabWhere('followups') } }),
      this.prisma.client.callingRecord.count({ where: { ...base, hiddenAt: null, nextFollowUpAt: { lte: new Date() } } }),
      this.prisma.client.callingRecord.count({ where: { ...base, ...this.tabWhere('hidden') } }),
    ]);
    return { active, followups, dueNow, hidden };
  }

  /** Full detail with history trail (attempts, outcomes, interests, shares, allocation events). */
  async detail(actor: Actor, id: string) {
    const r = await this.prisma.client.callingRecord.findUnique({
      where: { id },
      include: {
        assignedTelecaller: { select: { id: true, fullName: true } },
        batch: { select: { publicRef: true, uploadedAt: true } },
        outcomes: { orderBy: { at: 'desc' }, select: { id: true, outcome: true, remarks: true, followUpAt: true, selectedCardId: true, doNotContact: true, at: true, telecaller: { select: { id: true, fullName: true } } } },
        callAttempts: { orderBy: { initiatedAt: 'desc' }, select: { id: true, providerState: true, initiatedAt: true, connectedAt: true, endedAt: true, durationSec: true, failureReason: true, telecaller: { select: { id: true, fullName: true } } } },
        interests: { orderBy: { at: 'desc' }, select: { id: true, at: true, card: { select: { id: true, name: true, bank: { select: { displayName: true } } } } } },
        shareActions: { orderBy: { at: 'desc' }, select: { id: true, kind: true, channel: true, handoffResult: true, deliveryStatus: true, at: true } },
        allocationEvents: { orderBy: { at: 'asc' }, select: { id: true, at: true, reason: true, fromTelecallerUserId: true, toTelecallerUserId: true, actorUserId: true } },
      },
    });
    if (!r) throw AppError.notFound('Record');
    const ids = this.scope(actor);
    if (ids && (!r.assignedTelecallerUserId || !ids.includes(r.assignedTelecallerUserId))) throw AppError.notFound('Record'); // no existence leak across scope
    const remarks = await this.prisma.client.operationalRemark.findMany({ where: { entityType: 'CallingRecord', entityId: id }, orderBy: { at: 'desc' }, select: { id: true, text: true, at: true, editedAt: true, author: { select: { id: true, fullName: true } } } });
    return { ...toRow(r), panLast4: r.panLast4, reviewStatus: r.reviewStatus, batch: r.batch, outcomes: r.outcomes, callAttempts: r.callAttempts, interests: r.interests, shareActions: r.shareActions, allocationEvents: r.allocationEvents, remarks };
  }
}

type RecordWithRefs = {
  id: string;
  reviewStatus: string;
  assignedTelecallerUserId: string | null;
  fullName: string;
  mobile: string;
  pincode: string;
  resolvedCity: string | null;
  resolvedState: string | null;
  locationResolved: boolean;
  assignedTelecaller: { id: string; fullName: string } | null;
  assignedAt: Date | null;
  interactionStatus: string;
  nextFollowUpAt: Date | null;
  suppressed: boolean;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  batch: { publicRef: string };
  outcomes: Array<{ outcome: string; at: Date; remarks: string | null }>;
};

function toRow(r: RecordWithRefs): CallingQueueRow {
  const last = r.outcomes[0];
  return {
    id: r.id,
    fullName: r.fullName,
    mobileMasked: r.mobile.startsWith('+') ? (maskMobile(r.mobile) ?? '(invalid)') : '(invalid)',
    pincode: r.pincode,
    location: r.locationResolved ? `${r.resolvedCity}, ${r.resolvedState}` : 'Location unavailable',
    locationResolved: r.locationResolved,
    assignedTelecaller: r.assignedTelecaller,
    assignedAt: r.assignedAt?.toISOString() ?? null,
    interactionStatus: r.interactionStatus,
    nextFollowUpAt: r.nextFollowUpAt?.toISOString() ?? null,
    lastOutcome: last ? { outcome: last.outcome, at: last.at.toISOString(), remarks: last.remarks } : null,
    suppressed: r.suppressed,
    hiddenAt: r.hiddenAt?.toISOString() ?? null,
    hiddenReason: r.hiddenReason,
    canCall: !r.suppressed && !r.hiddenAt && r.mobile.startsWith('+'),
    batchRef: r.batch.publicRef,
    recordStatus: recordStatusOf(r),
  };
}
