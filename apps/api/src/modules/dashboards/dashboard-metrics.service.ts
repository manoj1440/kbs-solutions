import type { DashboardQuery, Distribution, Metric, MetricSource } from '@kbs/shared';
import { BANK_REMARK_FIELDS, isBlankBankValue } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { bucketOf, totalsOf } from '../payouts/ledger-buckets';
import { HierarchyService } from '../users/hierarchy.service';

const DAY = 86_400_000;
const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
export const DATE_BASIS = {
  record: 'Calling record upload date',
  attempt: 'Call initiated date',
  outcome: 'Outcome recorded date',
  share: 'Share recorded date',
  followUp: 'Follow-up due date',
  lead: 'KBS lead created date',
  eligible: 'Entitlement eligible date (MIS evidence)',
} as const;

export interface Scope {
  /** null = everyone (Admin without filters). */
  telecallerIds: string[] | null;
  advisorIds: string[] | null;
  label: string;
}

const m = (value: number, source: MetricSource, dateBasis: string, denominator?: { label: string; value: number }, amountInr?: number): Metric => ({ value, source, dateBasis, ...(denominator ? { denominator } : {}), ...(amountInr !== undefined ? { amountInr } : {}) });

/**
 * F-702 / F-703 metric engine (REQ-15 §15.2, REQ-16 §16.3). One implementation for Manager and Admin views so a
 * Manager's totals equal the Admin view filtered to that team (DASH-02). Every figure is a separate metric with its
 * own source and date basis: calls, shares, leads, bank values and payouts are never combined.
 */
@Injectable()
export class DashboardMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: HierarchyService,
    private readonly config: ConfigService,
  ) {}

  /** Resolve the population the actor may see. Out-of-scope filters → NOT_FOUND. */
  async scope(actor: Actor, q: DashboardQuery): Promise<Scope> {
    let team: string[] | null = null;
    let label = 'All teams';
    if (actor.role === 'MANAGER') {
      if (q.managerId && q.managerId !== actor.userId) throw AppError.notFound('Manager');
      team = actor.teamUserIds;
      label = 'My team';
    } else if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Dashboards are for Managers and Admin.');
    if (q.managerId && actor.role === 'ADMIN') {
      const mgr = await this.prisma.client.user.findUnique({ where: { id: q.managerId }, select: { role: true, fullName: true } });
      if (!mgr || mgr.role !== 'MANAGER') throw AppError.notFound('Manager');
      team = await this.hierarchy.teamUserIds(q.managerId);
      label = `Team of ${mgr.fullName}`;
    }
    let telecallerIds: string[] | null = null;
    let advisorIds: string[] | null = null;
    if (team) {
      const users = await this.prisma.client.user.findMany({ where: { id: { in: team } }, select: { id: true, role: true } });
      telecallerIds = users.filter((u) => u.role === 'TELECALLER').map((u) => u.id);
      advisorIds = users.filter((u) => u.role === 'ADVISOR').map((u) => u.id);
    }
    if (q.telecallerId) {
      if (telecallerIds && !telecallerIds.includes(q.telecallerId)) throw AppError.notFound('Telecaller');
      telecallerIds = [q.telecallerId];
    }
    if (q.advisorId) {
      if (advisorIds && !advisorIds.includes(q.advisorId)) throw AppError.notFound('Advisor');
      advisorIds = [q.advisorId];
    }
    return { telecallerIds, advisorIds, label };
  }

  private range(q: DashboardQuery) {
    if (!q.from && !q.to) return undefined;
    return { ...(q.from ? { gte: istStart(q.from) } : {}), ...(q.to ? { lt: new Date(istStart(q.to).getTime() + DAY) } : {}) };
  }

  async compute(scope: Scope, q: DashboardQuery) {
    const [calling, advisors] = await Promise.all([this.calling(scope, q), this.advisors(scope, q)]);
    return { scope: scope.label, calling, advisors, meta: await this.meta(q) };
  }

  async meta(q: DashboardQuery) {
    // per-bank MIS freshness — never a single global "live" status (REQ-16 §16.3)
    const banks = await this.prisma.client.bank.findMany({ where: { active: true }, select: { id: true, code: true, displayName: true } });
    const last = await this.prisma.client.misImportBatch.groupBy({ by: ['bankId'], where: { stage: 'APPLIED' }, _max: { appliedAt: true, uploadedAt: true } });
    const byBank = new Map(last.map((l) => [l.bankId, l]));
    return {
      from: q.from ?? null,
      to: q.to ?? null,
      dateBases: DATE_BASIS,
      misFreshness: banks.map((b) => ({ bank: b, lastAppliedAt: byBank.get(b.id)?._max.appliedAt?.toISOString() ?? null, lastUploadedAt: byBank.get(b.id)?._max.uploadedAt?.toISOString() ?? null })),
      asOf: new Date().toISOString(),
      note: 'Bank values are the latest accepted MIS only — never live bank status.',
    };
  }

  // ── calling (Telecaller operations) ──
  async calling(scope: Scope, q: DashboardQuery) {
    const range = this.range(q);
    const tc = scope.telecallerIds;
    const recWhere = { ...(tc ? { assignedTelecallerUserId: { in: tc } } : {}), ...(q.pincode ? { pincode: q.pincode } : {}), ...(q.state ? { resolvedState: { equals: q.state, mode: 'insensitive' as const } } : {}) };
    const recRange = range ? { createdAt: range } : {};
    const [uploaded, assigned, active, hidden] = await Promise.all([
      this.prisma.client.callingRecord.count({ where: { ...recWhere, ...recRange } }),
      this.prisma.client.callingRecord.count({ where: { ...recWhere, ...recRange, assignedTelecallerUserId: tc ? { in: tc } : { not: null } } }),
      this.prisma.client.callingRecord.count({ where: { ...recWhere, ...recRange, assignedTelecallerUserId: tc ? { in: tc } : { not: null }, hiddenAt: null, suppressed: false } }),
      this.prisma.client.callingRecord.count({ where: { ...recWhere, ...recRange, hiddenAt: { not: null } } }),
    ]);
    const onRecord = q.pincode || q.state ? { callingRecord: { ...(q.pincode ? { pincode: q.pincode } : {}), ...(q.state ? { resolvedState: { equals: q.state, mode: 'insensitive' as const } } : {}) } } : {};
    const attWhere = { ...(tc ? { telecallerUserId: { in: tc } } : {}), ...(range ? { initiatedAt: range } : {}), ...onRecord };
    const [confirmed, failedBeforeProvider, connected, noAnswer, failed, connectedWithRecording, contacted] = await Promise.all([
      this.prisma.client.callAttempt.count({ where: { ...attWhere, providerCallId: { not: null } } }),
      this.prisma.client.callAttempt.count({ where: { ...attWhere, providerCallId: null } }),
      this.prisma.client.callAttempt.count({ where: { ...attWhere, connectedAt: { not: null } } }),
      this.prisma.client.callAttempt.count({ where: { ...attWhere, providerState: 'NO_ANSWER' } }),
      this.prisma.client.callAttempt.count({ where: { ...attWhere, providerState: 'FAILED', providerCallId: { not: null } } }),
      this.prisma.client.callAttempt.count({ where: { ...attWhere, connectedAt: { not: null }, recording: { status: 'AVAILABLE' } } }),
      this.prisma.client.callAttempt.findMany({ where: { ...attWhere, connectedAt: { not: null } }, distinct: ['callingRecordId'], select: { callingRecordId: true } }),
    ]);
    const ownerTc = tc ? { ownerUserId: { in: tc } } : {};
    const [callbacksDue, callbacksDone] = await Promise.all([
      this.prisma.client.followUpTask.count({ where: { ...ownerTc, callingRecordId: { not: null }, doneAt: null, ...(range ? { dueAt: range } : { dueAt: { lte: new Date() } }) } }),
      this.prisma.client.followUpTask.count({ where: { ...ownerTc, callingRecordId: { not: null }, doneAt: range ? range : { not: null } } }),
    ]);
    const outcomes = await this.prisma.client.callOutcome.groupBy({ by: ['outcome'], where: { ...(tc ? { telecallerUserId: { in: tc } } : {}), ...(range ? { at: range } : {}), ...onRecord }, _count: { _all: true } });
    const shares = await this.prisma.client.shareAction.groupBy({ by: ['kind'], where: { callingRecordId: { not: null }, ...(tc ? { actorUserId: { in: tc } } : {}), ...(range ? { at: range } : {}) }, _count: { _all: true } });
    const delivered = await this.prisma.client.shareAction.count({ where: { callingRecordId: { not: null }, ...(tc ? { actorUserId: { in: tc } } : {}), ...(range ? { at: range } : {}), deliveryStatus: 'DELIVERED' } });
    const shareTotal = shares.reduce((a, s) => a + s._count._all, 0);
    return {
      records: { uploaded: m(uploaded, 'KBS_CALLING', DATE_BASIS.record), assigned: m(assigned, 'KBS_CALLING', DATE_BASIS.record, { label: 'uploaded', value: uploaded }), active: m(active, 'KBS_CALLING', DATE_BASIS.record, { label: 'assigned', value: assigned }), hidden: m(hidden, 'KBS_CALLING', DATE_BASIS.record) },
      calls: {
        attempts: m(confirmed, 'TELEPHONY_PROVIDER', DATE_BASIS.attempt),
        failedBeforeProvider: m(failedBeforeProvider, 'KBS_CALLING', DATE_BASIS.attempt),
        connected: m(connected, 'TELEPHONY_PROVIDER', DATE_BASIS.attempt, { label: 'provider-confirmed attempts', value: confirmed }),
        notAnswered: m(noAnswer, 'TELEPHONY_PROVIDER', DATE_BASIS.attempt, { label: 'provider-confirmed attempts', value: confirmed }),
        failed: m(failed, 'TELEPHONY_PROVIDER', DATE_BASIS.attempt, { label: 'provider-confirmed attempts', value: confirmed }),
        uniqueCustomersContacted: m(contacted.length, 'TELEPHONY_PROVIDER', DATE_BASIS.attempt),
        recordingsAvailable: m(connectedWithRecording, 'TELEPHONY_PROVIDER', DATE_BASIS.attempt, { label: 'connected calls', value: connected }),
      },
      callbacks: { due: m(callbacksDue, 'KBS_CALLING', DATE_BASIS.followUp), completed: m(callbacksDone, 'KBS_CALLING', DATE_BASIS.followUp) },
      outcomes: Object.fromEntries(outcomes.map((o) => [o.outcome, m(o._count._all, 'KBS_CALLING', DATE_BASIS.outcome)])),
      shares: { total: m(shareTotal, 'KBS_SHARING', DATE_BASIS.share), delivered: m(delivered, 'KBS_SHARING', DATE_BASIS.share, { label: 'shares recorded', value: shareTotal }), byKind: Object.fromEntries(shares.map((s) => [s.kind, m(s._count._all, 'KBS_SHARING', DATE_BASIS.share)])) },
    };
  }

  // ── advisors (leads, bank MIS values, payouts) ──
  leadWhere(scope: Scope, q: DashboardQuery) {
    const range = this.range(q);
    const now = Date.now();
    const recency =
      q.misRecency === 'never'
        ? { statusSnapshot: { is: null } }
        : q.misRecency === 'within7'
          ? { statusSnapshot: { is: { lastMatchedAt: { gte: new Date(now - 7 * DAY) } } } }
          : q.misRecency === 'within30'
            ? { statusSnapshot: { is: { lastMatchedAt: { gte: new Date(now - 30 * DAY) } } } }
            : q.misRecency === 'older30'
              ? { statusSnapshot: { is: { lastMatchedAt: { lt: new Date(now - 30 * DAY) } } } }
              : {};
    return {
      ...(scope.advisorIds ? { advisorUserId: { in: scope.advisorIds } } : {}),
      ...(range ? { createdAt: range } : {}),
      ...(q.bankId ? { bankId: q.bankId } : {}),
      ...(q.cardId ? { cardId: q.cardId } : {}),
      ...(q.pincode ? { pincode: q.pincode } : {}),
      ...(q.state ? { state: { equals: q.state, mode: 'insensitive' as const } } : {}),
      ...recency,
    };
  }

  async advisors(scope: Scope, q: DashboardQuery) {
    const where = this.leadWhere(scope, q);
    const tokens = this.config.getJson<string[]>('mis.blankValueTokens');
    const leads = await this.prisma.client.lead.findMany({ where, select: { id: true, statusSnapshot: { select: { currentStage: true, finalDecision: true, cardActivationStatus: true, dropoffReason: true, declineCode: true, declineDescription: true, declineDescription2: true, declineType: true, reason: true } } } });
    const total = leads.length;
    const matched = leads.filter((l) => l.statusSnapshot).length;
    const dist = (field: 'currentStage' | 'finalDecision' | 'cardActivationStatus'): Distribution => {
      const counts = new Map<string, number>();
      for (const l of leads) {
        const raw = l.statusSnapshot ? l.statusSnapshot[field] : undefined;
        const key = !l.statusSnapshot ? 'Awaiting MIS' : raw === null || raw === undefined || isBlankBankValue(raw, tokens) ? 'Not reported' : raw.trim();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return { source: 'BANK_MIS', dateBasis: DATE_BASIS.lead, buckets: [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)), denominator: { label: 'leads', value: total } };
    };
    // actionable bank reasons: leads whose latest matching MIS carries a remark/decline field (verbatim value)
    const reasonCounts = new Map<string, number>();
    let withReason = 0;
    for (const l of leads) {
      if (!l.statusSnapshot) continue;
      const vals = BANK_REMARK_FIELDS.map((f) => (l.statusSnapshot as Record<string, string | null>)[f.field]).filter((v): v is string => typeof v === 'string' && !isBlankBankValue(v, tokens));
      if (!vals.length) continue;
      withReason += 1;
      const key = vals[0].trim();
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    // payouts for the same advisor population (entitlement eligible date)
    const range = this.range(q);
    const ents = await this.prisma.client.payoutEntitlement.findMany({
      where: { ...(scope.advisorIds ? { advisorUserId: { in: scope.advisorIds } } : {}), ...(q.bankId ? { bankId: q.bankId } : {}), ...(q.cardId ? { cardId: q.cardId } : {}), ...(range ? { eligibleAt: range } : {}) },
      select: { state: true, amountInr: true, requestItems: { where: { active: true }, take: 1, select: { request: { select: { state: true } } } } },
    });
    const t = totalsOf(ents.map((e) => ({ bucket: bucketOf(e.state, e.requestItems[0]?.request.state), amountInr: Number(e.amountInr) })));
    const paidConfirmed = await this.prisma.client.externalPayment.aggregate({ where: { state: { in: ['VERIFIED', 'EXCEPTION'] }, request: { state: 'PAID', ...(scope.advisorIds ? { advisorUserId: { in: scope.advisorIds } } : {}) } }, _sum: { amountInr: true } });
    const pm = (b: keyof typeof t) => m(t[b].count, 'KBS_PAYOUT_LEDGER', DATE_BASIS.eligible, undefined, t[b].amountInr);
    return {
      leads: { created: m(total, 'KBS_LEADS', DATE_BASIS.lead), misMatched: m(matched, 'BANK_MIS', DATE_BASIS.lead, { label: 'leads', value: total }), awaitingMis: m(total - matched, 'BANK_MIS', DATE_BASIS.lead, { label: 'leads', value: total }) },
      stage: dist('currentStage'),
      decision: dist('finalDecision'),
      activation: dist('cardActivationStatus'),
      bankReasons: { leadsWithReason: m(withReason, 'BANK_MIS', DATE_BASIS.lead, { label: 'MIS-matched leads', value: matched }), top: [...reasonCounts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count).slice(0, 10) },
      payouts: { eligible: pm('eligible'), available: pm('available'), requested: pm('requested'), approvedUnpaid: pm('approvedUnpaid'), onHold: pm('onHold'), paid: pm('paid'), confirmedTransfersInr: m(Number(paidConfirmed._sum.amountInr ?? 0), 'ACCOUNTS_PAYMENT', 'Accounts paid date (all time)', undefined, Number(paidConfirmed._sum.amountInr ?? 0)) },
    };
  }
}
