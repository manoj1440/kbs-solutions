import { activationBucket, type AdvisorTeamResponse, type CallingRecordsSummary, type DashboardQuery, decisionBucket, LeadListQuery, type LeadStatusRow, maskMobile, PayoutDashboardQuery } from '@kbs/shared';
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
    // Same loose bank-verbatim buckets as LeadsService.summary / MisImportService.applicationsSummary (F-811):
    // banks write Approve/Approved/APPROVED; 'Awaiting MIS' / 'Not reported' are not bank values.
    const UNKNOWN = new Set(['Awaiting MIS', 'Not reported']);
    const biz = { approved: 0, declined: 0, inProcess: 0, activated: 0 };
    for (const b of advisors.decision.buckets) {
      if (UNKNOWN.has(b.value)) continue;
      biz[decisionBucket(b.value)] += b.count;
    }
    for (const b of advisors.activation.buckets) {
      if (!UNKNOWN.has(b.value) && activationBucket(b.value) === 'active') biz.activated += b.count;
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
      recentLeads: recent.data as LeadStatusRow[],
      asOf: new Date().toISOString(),
      note: 'Bank values are the latest accepted MIS only — never live bank status.',
      dateBases: DATE_BASIS,
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
