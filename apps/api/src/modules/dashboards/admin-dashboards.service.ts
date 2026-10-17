import { activationBucket, type AdminTodayResponse, type AdminTrendPoint, type AdminTrendQuery, type AdminTrendResponse, type AdvisorTeamResponse, type CallingRecordsSummary, type DashboardQuery, decisionBucket, isBlankBankValue, LeadListQuery, type LeadStatusRow, maskMobile, PayoutDashboardQuery } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CallingQueueService } from '../calling-list/calling-queue.service';
import { ConfigService } from '../config/config.service';
import { LeadsService } from '../leads/leads.service';
import { MisImportService } from '../mis/mis-import.service';
import { bucketOf, totalsOf } from '../payouts/ledger-buckets';
import { PayoutDashboardService } from '../payouts/payout-dashboard.service';
import { HierarchyService } from '../users/hierarchy.service';

import { DATE_BASIS, DashboardMetricsService } from './dashboard-metrics.service';

const DAY = 86_400_000;
/** 'YYYY-MM-DD' ± n calendar days. */
const shiftDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
/** IST calendar day of an instant. */
const istDay = (t: Date) => new Date(t.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Same loose bank-verbatim buckets as LeadsService.summary / MisImportService.applicationsSummary (F-811):
 * banks write Approve/Approved/APPROVED; 'Awaiting MIS' / 'Not reported' are not bank values.
 */
function bizBuckets(advisors: { decision: { buckets: { value: string; count: number }[] }; activation: { buckets: { value: string; count: number }[] } }) {
  const UNKNOWN = new Set(['Awaiting MIS', 'Not reported']);
  const biz = { approved: 0, declined: 0, inProcess: 0, activated: 0 };
  for (const b of advisors.decision.buckets) {
    if (UNKNOWN.has(b.value)) continue;
    biz[decisionBucket(b.value)] += b.count;
  }
  for (const b of advisors.activation.buckets) {
    if (!UNKNOWN.has(b.value) && activationBucket(b.value) === 'active') biz.activated += b.count;
  }
  return biz;
}

export interface Alert {
  kind: 'MIS_UNMATCHED' | 'MIS_CONFLICT' | 'PAYOUT_EXCEPTIONS' | 'LAUNCH_GATES_OPEN' | 'BANK_NEVER_APPLIED';
  count: number;
  message: string;
  href: string;
}

/**
 * F-703 Admin dashboards (REQ-16 §16.2). Built on the F-702 metric engine so per-team, per-person and organisation
 * figures reconcile. Conflicts/unmatched rows always raise an alert on the executive view — never hidden behind a
 * green KPI (REQ-20 §20.4).
 */
@Injectable()
export class AdminDashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: DashboardMetricsService,
    private readonly payouts: PayoutDashboardService,
    private readonly config: ConfigService,
    private readonly hierarchy: HierarchyService,
    private readonly callingQueue: CallingQueueService,
    private readonly misImport: MisImportService,
    private readonly leadsService: LeadsService,
  ) {}

  private assertAdmin(actor: Actor) {
    if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Admin dashboards are for the Admin.');
  }

  /**
   * F-811 Admin home: business-first figures for a date range (from/to) plus all-time context. Every bank figure is
   * a passthrough from the metric engine or the owning service — nothing here computes a bank value itself
   * (INV-01..03).
   */
  async home(actor: Actor, q: DashboardQuery) {
    this.assertAdmin(actor);
    const scope = await this.metrics.scope(actor, q);
    const leadListQuery = LeadListQuery.parse({ pageSize: 10, ...(q.from ? { from: q.from } : {}), ...(q.to ? { to: q.to } : {}) });
    const [peopleRows, pipeline, mis, leadsCum, payoutCum, advisors, calling, telecallers, banks, activeBanks, cards, publishedCards, recent] = await Promise.all([
      this.prisma.client.user.groupBy({ by: ['role', 'status'], _count: { _all: true } }),
      this.callingQueue.summary(actor),
      this.misImport.applicationsSummary(),
      this.leadsService.summary(actor),
      this.payouts.summary(actor, PayoutDashboardQuery.parse({})),
      this.metrics.advisors(scope, q),
      this.metrics.calling(scope, q),
      this.telecallers(actor, q),
      this.prisma.client.bank.count(),
      this.prisma.client.bank.count({ where: { active: true } }),
      this.prisma.client.creditCard.count(),
      this.prisma.client.creditCard.count({ where: { status: 'PUBLISHED' } }),
      this.leadsService.list(actor, leadListQuery),
    ]);
    const people = Object.fromEntries(['TELECALLER', 'MANAGER', 'ADVISOR', 'ACCOUNTS'].map((r) => [r, { total: 0, active: 0 }])) as Record<'TELECALLER' | 'MANAGER' | 'ADVISOR' | 'ACCOUNTS', { total: number; active: number }>;
    for (const g of peopleRows) {
      const slot = people[g.role as keyof typeof people];
      if (!slot) continue;
      slot.total += g._count._all;
      if (g.status === 'ACTIVE') slot.active += g._count._all;
    }
    const { values: _ignored, ...misSummary } = mis;
    const biz = bizBuckets(advisors);
    // F-814: the same figures for the equal-length period just before [from, to] — for "▲ 12% vs prev." deltas
    let previous = null;
    if (q.from && q.to) {
      const days = Math.round((Date.parse(q.to) - Date.parse(q.from)) / DAY) + 1;
      const prevQ = { ...q, from: shiftDay(q.from, -days), to: shiftDay(q.from, -1) };
      const [pa, pc] = await Promise.all([this.metrics.advisors(scope, prevQ), this.metrics.calling(scope, prevQ)]);
      const pb = bizBuckets(pa);
      previous = {
        range: { from: prevQ.from, to: prevQ.to },
        leads: pa.leads.created.value,
        approved: pb.approved,
        activated: pb.activated,
        declined: pb.declined,
        inProcess: pb.inProcess,
        payoutEarnedInr: pa.payouts.eligible.amountInr ?? 0,
        calls: pc.calls.attempts.value,
        connected: pc.calls.connected.value,
      };
    }
    return {
      range: { from: q.from ?? null, to: q.to ?? null },
      people,
      catalogue: { banks: { total: banks, active: activeBanks }, cards: { total: cards, published: publishedCards } },
      cumulative: {
        mis: misSummary,
        leads: { total: leadsCum.total, matched: leadsCum.matched, awaitingMis: leadsCum.awaitingMis },
        payouts: { eligible: payoutCum.totals.eligible, paid: payoutCum.totals.paid },
      },
      business: {
        leads: advisors.leads,
        approved: biz.approved,
        activated: biz.activated,
        declined: biz.declined,
        inProcess: biz.inProcess,
        decision: advisors.decision,
        activation: advisors.activation,
        payouts: advisors.payouts,
      },
      calling: {
        records: calling.records,
        calls: calling.calls,
        callbacks: calling.callbacks,
        outcomes: calling.outcomes,
        shares: calling.shares,
        byCaller: telecallers.rows,
        pipeline: pipeline as CallingRecordsSummary,
      },
      previous,
      recentLeads: recent.data as LeadStatusRow[],
      asOf: new Date().toISOString(),
      note: 'Bank values are the latest accepted MIS only — never live bank status.',
      dateBases: DATE_BASIS,
    };
  }

  /**
   * F-814 Admin home trend: per IST day (or week) the same figures as `home` — leads by created date, approved /
   * activated from the latest accepted MIS of those leads (same buckets), payout earned by eligible date, calls by
   * initiated date. Buckets sum to the `home` figures for the same range. Organisation-wide.
   */
  async trend(actor: Actor, q: AdminTrendQuery): Promise<AdminTrendResponse> {
    this.assertAdmin(actor);
    const days = Math.round((Date.parse(q.to) - Date.parse(q.from)) / DAY) + 1;
    if (days < 1) throw new AppError('VALIDATION_FAILED', '"From" must be on or before "To".');
    if (days > 366) throw new AppError('VALIDATION_FAILED', 'Choose a range of one year or less.');
    const bucket = q.bucket ?? (days <= 92 ? 'day' : 'week');
    const step = bucket === 'day' ? 1 : 7;
    const points: AdminTrendPoint[] = Array.from({ length: Math.ceil(days / step) }, (_, i) => ({ start: shiftDay(q.from, i * step), leads: 0, approved: 0, activated: 0, payoutEarnedInr: 0, calls: 0, connected: 0 }));
    const at = (t: Date) => points[Math.floor(Math.round((Date.parse(istDay(t)) - Date.parse(q.from)) / DAY) / step)];
    const range = { gte: istStart(q.from), lt: new Date(istStart(q.to).getTime() + DAY) };
    const tokens = this.config.getJson<string[]>('mis.blankValueTokens');
    const known = (v: string | null | undefined): v is string => v != null && !isBlankBankValue(v, tokens);
    const [leads, ents, attempts] = await Promise.all([
      this.prisma.client.lead.findMany({ where: { createdAt: range }, select: { createdAt: true, statusSnapshot: { select: { finalDecision: true, cardActivationStatus: true } } } }),
      this.prisma.client.payoutEntitlement.findMany({ where: { eligibleAt: range }, select: { eligibleAt: true, state: true, amountInr: true, requestItems: { where: { active: true }, take: 1, select: { request: { select: { state: true } } } } } }),
      this.prisma.client.callAttempt.findMany({ where: { initiatedAt: range }, select: { initiatedAt: true, providerCallId: true, connectedAt: true } }),
    ]);
    for (const l of leads) {
      const p = at(l.createdAt);
      p.leads += 1;
      const s = l.statusSnapshot;
      if (s && known(s.finalDecision) && decisionBucket(s.finalDecision.trim()) === 'approved') p.approved += 1;
      if (s && known(s.cardActivationStatus) && activationBucket(s.cardActivationStatus.trim()) === 'active') p.activated += 1;
    }
    const perPoint = new Map<AdminTrendPoint, { bucket: ReturnType<typeof bucketOf>; amountInr: number }[]>();
    for (const e of ents) {
      if (!e.eligibleAt) continue;
      const p = at(e.eligibleAt);
      perPoint.set(p, [...(perPoint.get(p) ?? []), { bucket: bucketOf(e.state, e.requestItems[0]?.request.state), amountInr: Number(e.amountInr) }]);
    }
    for (const [p, rows] of perPoint) p.payoutEarnedInr = totalsOf(rows).eligible.amountInr;
    for (const a of attempts) {
      const p = at(a.initiatedAt);
      if (a.providerCallId) p.calls += 1;
      if (a.connectedAt) p.connected += 1;
    }
    return { range: { from: q.from, to: q.to }, bucket, points, note: 'Bank values are the latest accepted MIS only — never live bank status.' };
  }

  /** F-814 "Today" rail: follow-ups due by end of today (incl. overdue), advisors awaiting review, payout requests awaiting the Admin, MIS rows needing resolution. */
  async today(actor: Actor): Promise<AdminTodayResponse> {
    this.assertAdmin(actor);
    const now = new Date();
    const startToday = istStart(istDay(now));
    const due = { doneAt: null, dueAt: { lt: new Date(startToday.getTime() + DAY) } };
    const awaitingAdmin = { state: 'PENDING_APPROVALS' as const, approvals: { none: { approverRole: 'ADMIN' as const } } };
    const [fuCount, fuOverdue, fu, onbCount, onb, payCount, pay, unmatched, conflicts] = await Promise.all([
      this.prisma.client.followUpTask.count({ where: due }),
      this.prisma.client.followUpTask.count({ where: { doneAt: null, dueAt: { lt: startToday } } }),
      this.prisma.client.followUpTask.findMany({ where: due, orderBy: { dueAt: 'asc' }, take: 5, select: { id: true, text: true, dueAt: true, leadId: true, owner: { select: { fullName: true } } } }),
      this.prisma.client.advisorProfile.count({ where: { onboardingStep: 'AWAITING_REVIEW' } }),
      this.prisma.client.advisorProfile.findMany({ where: { onboardingStep: 'AWAITING_REVIEW' }, orderBy: { submittedAt: 'asc' }, take: 5, select: { submittedAt: true, user: { select: { id: true, fullName: true, publicRef: true } } } }),
      this.prisma.client.payoutRequest.count({ where: awaitingAdmin }),
      this.prisma.client.payoutRequest.findMany({ where: awaitingAdmin, orderBy: { submittedAt: 'asc' }, take: 5, select: { id: true, publicRef: true, totalAmountInr: true, submittedAt: true, advisor: { select: { fullName: true } } } }),
      this.prisma.client.misRow.count({ where: { matchState: 'UNMATCHED' } }),
      this.prisma.client.misRow.count({ where: { matchState: 'CONFLICT' } }),
    ]);
    return {
      followUps: { count: fuCount, overdue: fuOverdue, items: fu.map((t) => ({ id: t.id, text: t.text, dueAt: t.dueAt.toISOString(), ownerName: t.owner.fullName, kind: t.leadId ? 'LEAD' : 'CALLBACK', leadId: t.leadId })) },
      onboarding: { count: onbCount, items: onb.map((p) => ({ userId: p.user.id, fullName: p.user.fullName, publicRef: p.user.publicRef, submittedAt: p.submittedAt?.toISOString() ?? null })) },
      payoutApprovals: { count: payCount, items: pay.map((r) => ({ id: r.id, publicRef: r.publicRef, advisorName: r.advisor.fullName, amountInr: Number(r.totalAmountInr), submittedAt: r.submittedAt.toISOString() })) },
      misExceptions: { unmatched, conflicts },
      asOf: now.toISOString(),
    };
  }

  async executive(actor: Actor, q: DashboardQuery) {
    this.assertAdmin(actor);
    const base = await this.metrics.compute(await this.metrics.scope(actor, q), q);
    const [unmatched, conflicts, exceptions, gates] = await Promise.all([
      this.prisma.client.misRow.count({ where: { matchState: 'UNMATCHED', ...(q.bankId ? { batch: { bankId: q.bankId } } : {}) } }),
      this.prisma.client.misRow.count({ where: { matchState: 'CONFLICT', ...(q.bankId ? { batch: { bankId: q.bankId } } : {}) } }),
      this.payouts.exceptions(actor, { managerId: q.managerId, advisorId: q.advisorId, bankId: q.bankId }),
      this.config.launchGates(),
    ]);
    const openGates = gates.filter((g) => !g.isSet);
    const alerts: Alert[] = [];
    if (unmatched) alerts.push({ kind: 'MIS_UNMATCHED', count: unmatched, message: `${unmatched} bank MIS row(s) are unmatched and waiting in quarantine`, href: '/admin/mis/integrity' });
    if (conflicts) alerts.push({ kind: 'MIS_CONFLICT', count: conflicts, message: `${conflicts} bank MIS row(s) conflict with KBS references`, href: '/admin/mis/integrity' });
    if (exceptions.length) alerts.push({ kind: 'PAYOUT_EXCEPTIONS', count: exceptions.length, message: `${exceptions.length} open payout exception(s)`, href: '/admin/payouts/liability' });
    if (openGates.length) alerts.push({ kind: 'LAUNCH_GATES_OPEN', count: openGates.length, message: `${openGates.length} launch-gate setting(s) still need a KBS decision`, href: '/admin/config' });
    const neverApplied = base.meta.misFreshness.filter((f) => !f.lastAppliedAt).length;
    if (neverApplied) alerts.push({ kind: 'BANK_NEVER_APPLIED', count: neverApplied, message: `${neverApplied} active bank(s) have no applied MIS yet — their leads show Awaiting MIS`, href: '/admin/mis' });
    return { ...base, alerts, launchGates: gates };
  }

  private async users(role: 'TELECALLER' | 'ADVISOR' | 'MANAGER', q: DashboardQuery) {
    const team = q.managerId ? await this.hierarchy.teamUserIds(q.managerId) : null;
    return this.prisma.client.user.findMany({ where: { role, ...(team ? { id: { in: team } } : {}) }, select: { id: true, fullName: true, publicRef: true, status: true }, orderBy: { fullName: 'asc' } });
  }

  /** Telecaller performance: evidence per person, no ranking or score (REQ-15 §15.3). */
  async telecallers(actor: Actor, q: DashboardQuery) {
    this.assertAdmin(actor);
    const people = q.telecallerId ? await this.prisma.client.user.findMany({ where: { id: q.telecallerId, role: 'TELECALLER' }, select: { id: true, fullName: true, publicRef: true, status: true } }) : await this.users('TELECALLER', q);
    const rows = [];
    for (const u of people) {
      const c = await this.metrics.calling({ telecallerIds: [u.id], advisorIds: [], label: u.fullName }, q);
      rows.push({ user: u, records: c.records, calls: c.calls, callbacks: c.callbacks, shares: { total: c.shares.total }, outcomes: c.outcomes });
    }
    return { rows, meta: await this.metrics.meta(q) };
  }

  async advisors(actor: Actor, q: DashboardQuery) {
    this.assertAdmin(actor);
    const people = q.advisorId ? await this.prisma.client.user.findMany({ where: { id: q.advisorId, role: 'ADVISOR' }, select: { id: true, fullName: true, publicRef: true, status: true } }) : await this.users('ADVISOR', q);
    const rows = [];
    for (const u of people) {
      const a = await this.metrics.advisors({ telecallerIds: [], advisorIds: [u.id], label: u.fullName }, q);
      rows.push({ user: u, leads: a.leads, decision: a.decision, activation: a.activation, payouts: a.payouts });
    }
    return { rows, meta: await this.metrics.meta(q) };
  }

  /**
   * F-315: per-Advisor drill-down for a Manager's own team (Admin: any team via managerId). Same F-702 engine per
   * Advisor, so the numbers equal the Manager dashboard filtered to that Advisor. Evidence only — no score or rank.
   */
  async teamAdvisors(actor: Actor, q: DashboardQuery): Promise<AdvisorTeamResponse> {
    const scope = await this.metrics.scope(actor, q);
    const people = await this.prisma.client.user.findMany({
      where: { role: 'ADVISOR', ...(scope.advisorIds ? { id: { in: scope.advisorIds } } : {}) },
      select: {
        id: true,
        fullName: true,
        publicRef: true,
        status: true,
        mobile: true,
        createdAt: true,
        reportingAsChild: { where: { effectiveTo: null, status: 'ACTIVE' }, orderBy: { effectiveFrom: 'desc' }, take: 1, select: { source: true, effectiveFrom: true, parent: { select: { id: true, fullName: true } }, agentCode: { select: { code: true } } } },
      },
      orderBy: { fullName: 'asc' },
    });
    const ids = people.map((p) => p.id);
    const awaiting = ids.length
      ? await this.prisma.client.payoutRequest.groupBy({ by: ['advisorUserId'], where: { advisorUserId: { in: ids }, state: 'PENDING_APPROVALS', approvals: { none: { approverRole: 'MANAGER' } } }, _count: { _all: true } })
      : [];
    const awaitingMap = new Map(awaiting.map((a) => [a.advisorUserId, a._count._all]));
    const rows = [];
    for (const u of people) {
      const a = await this.metrics.advisors({ telecallerIds: [], advisorIds: [u.id], label: u.fullName }, q);
      const r = u.reportingAsChild[0];
      rows.push({
        user: { id: u.id, fullName: u.fullName, publicRef: u.publicRef, status: u.status, mobileMasked: maskMobile(u.mobile), joinedAt: u.createdAt.toISOString() },
        reporting: r ? { source: r.source, since: r.effectiveFrom.toISOString(), parent: r.parent, agentCode: r.agentCode?.code ?? null } : null,
        leads: a.leads,
        stage: a.stage,
        decision: a.decision,
        activation: a.activation,
        bankReasons: a.bankReasons,
        payouts: a.payouts,
        awaitingManagerApproval: awaitingMap.get(u.id) ?? 0,
      });
    }
    return { scope: scope.label, rows, meta: await this.metrics.meta(q) };
  }

  async managers(actor: Actor, q: DashboardQuery) {
    this.assertAdmin(actor);
    const managers = await this.prisma.client.user.findMany({ where: { role: 'MANAGER', ...(q.managerId ? { id: q.managerId } : {}) }, select: { id: true, fullName: true, publicRef: true, status: true }, orderBy: { fullName: 'asc' } });
    const rows = [];
    for (const u of managers) {
      const scope = await this.metrics.scope(actor, { ...q, managerId: u.id });
      const d = await this.metrics.compute(scope, { ...q, managerId: u.id });
      rows.push({ user: u, telecallers: scope.telecallerIds?.length ?? 0, advisors: scope.advisorIds?.length ?? 0, calls: { attempts: d.calling.calls.attempts, connected: d.calling.calls.connected }, shares: d.calling.shares.total, leads: d.advisors.leads, payouts: { eligible: d.advisors.payouts.eligible, approvedUnpaid: d.advisors.payouts.approvedUnpaid, paid: d.advisors.payouts.paid } });
    }
    return { rows, meta: await this.metrics.meta(q) };
  }

  /** Bank/card mix: leads, MIS coverage and payout events per bank × card (latest accepted MIS only). */
  async bankCardMix(actor: Actor, q: DashboardQuery) {
    this.assertAdmin(actor);
    const scope = await this.metrics.scope(actor, q);
    const where = this.metrics.leadWhere(scope, q);
    const [total, matched] = await Promise.all([
      this.prisma.client.lead.groupBy({ by: ['bankId', 'cardId'], where, _count: { _all: true } }),
      this.prisma.client.lead.groupBy({ by: ['bankId', 'cardId'], where: { ...where, statusSnapshot: { isNot: null } }, _count: { _all: true } }),
    ]);
    const ents = await this.prisma.client.payoutEntitlement.findMany({ where: { lead: where }, select: { bankId: true, cardId: true, state: true, amountInr: true, requestItems: { where: { active: true }, take: 1, select: { request: { select: { state: true } } } } } });
    const banks = new Map((await this.prisma.client.bank.findMany({ select: { id: true, code: true, displayName: true } })).map((b) => [b.id, b]));
    const cards = new Map((await this.prisma.client.creditCard.findMany({ where: { id: { in: total.map((t) => t.cardId) } }, select: { id: true, name: true } })).map((c) => [c.id, c]));
    const rows = total.map((t) => {
      const mine = ents.filter((e) => e.bankId === t.bankId && e.cardId === t.cardId);
      const tot = totalsOf(mine.map((e) => ({ bucket: bucketOf(e.state, e.requestItems[0]?.request.state), amountInr: Number(e.amountInr) })));
      const m = matched.find((x) => x.bankId === t.bankId && x.cardId === t.cardId)?._count._all ?? 0;
      return { bank: banks.get(t.bankId) ?? { id: t.bankId, code: '?', displayName: '?' }, card: cards.get(t.cardId) ?? { id: t.cardId, name: '?' }, leads: t._count._all, misMatched: m, awaitingMis: t._count._all - m, payoutEligible: tot.eligible, payoutPaid: tot.paid };
    });
    rows.sort((a, b) => b.leads - a.leads || a.bank.displayName.localeCompare(b.bank.displayName));
    return { rows, meta: { ...(await this.metrics.meta(q)), source: 'KBS leads + latest accepted bank MIS + payout ledger', dateBasis: 'KBS lead created date' } };
  }
}
