import type { PayoutDashboardQuery, PayoutExceptionKind, ResolvePayoutExceptionBody } from '@kbs/shared';
import { formatInr } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { HierarchyService } from '../users/hierarchy.service';

import { bucketOf, totalsOf } from './ledger-buckets';

const DAY = 86_400_000;
const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
const LIVE = ['RECORDED', 'PROOF_PENDING', 'VERIFIED', 'EXCEPTION'] as const;
const TERMINAL = ['REJECTED', 'CANCELLED'];

export interface PayoutExceptionItem {
  kind: PayoutExceptionKind;
  subjectId: string;
  request: { id: string; publicRef: string; state: string } | null;
  advisor: { id: string; fullName: string } | null;
  amountInr: number | null;
  detail: string;
  raisedAt: string;
  /** true → acknowledge via POST /payouts/exceptions/resolve; false → use `resolvedVia`. */
  acknowledgeable: boolean;
  resolvedVia: string | null;
}

/**
 * F-606 — payout liability & reconciliation (REQ-17 §17.9, REQ-16 §16.2). Every figure comes from the same entitlement
 * ledger and the same bucket classifier as the Advisor ledger, so Advisor, Manager, Admin and Accounts totals agree.
 * Exceptions are derived on read; only acknowledgements are stored (no clawback/refund automation).
 */
@Injectable()
export class PayoutDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly hierarchy: HierarchyService,
  ) {}

  /** Advisor ids in scope, or null for "everyone". Out-of-scope filters are NOT_FOUND (never reveal other teams). */
  private async advisorScope(actor: Actor, q: Pick<PayoutDashboardQuery, 'managerId' | 'advisorId'>): Promise<string[] | null> {
    let ids: string[] | null = null;
    if (actor.role === 'MANAGER') ids = actor.teamUserIds;
    else if (actor.role !== 'ADMIN' && actor.role !== 'ACCOUNTS') throw new AppError('RBAC_FORBIDDEN', 'Not available for your role.');
    if (q.managerId) {
      if (actor.role === 'MANAGER' && q.managerId !== actor.userId) throw AppError.notFound('Manager');
      const team = await this.hierarchy.teamUserIds(q.managerId);
      ids = ids ? ids.filter((i) => team.includes(i)) : team;
    }
    if (q.advisorId) {
      if (ids && !ids.includes(q.advisorId)) throw AppError.notFound('Advisor');
      ids = [q.advisorId];
    }
    return ids;
  }

  private range(q: PayoutDashboardQuery) {
    if (!q.from && !q.to) return undefined;
    return { ...(q.from ? { gte: istStart(q.from) } : {}), ...(q.to ? { lt: new Date(istStart(q.to).getTime() + DAY) } : {}) };
  }

  async summary(actor: Actor, q: PayoutDashboardQuery) {
    const advisors = await this.advisorScope(actor, q);
    const range = this.range(q);
    const who = advisors ? { advisorUserId: { in: advisors } } : {};
    const bank = q.bankId ? { bankId: q.bankId } : {};
    const dated =
      !range ? {} : q.dateBasis === 'eligibleAt' ? { eligibleAt: range } : q.dateBasis === 'submittedAt' ? { requestItems: { some: { active: true, request: { submittedAt: range } } } } : { requestItems: { some: { active: true, request: { paidAt: range } } } };
    const ents = await this.prisma.client.payoutEntitlement.findMany({
      where: { ...who, ...bank, ...dated },
      select: { state: true, amountInr: true, requestItems: { where: { active: true }, take: 1, select: { request: { select: { state: true } } } } },
    });
    const totals = totalsOf(ents.map((e) => ({ bucket: bucketOf(e.state, e.requestItems[0]?.request.state), amountInr: Number(e.amountInr) })));

    // Paid amount = externally confirmed transfers, not approved totals (REQ-17 §17.9)
    const reqWhere = { ...(advisors ? { advisorUserId: { in: advisors } } : {}), ...(q.bankId ? { items: { some: { active: true, entitlement: { bankId: q.bankId } } } } : {}) };
    const paidReqRange = range && q.dateBasis === 'paidAt' ? { paidAt: range } : range && q.dateBasis === 'submittedAt' ? { submittedAt: range } : {};
    const confirmed = await this.prisma.client.externalPayment.aggregate({ where: { state: { in: ['VERIFIED', 'EXCEPTION'] }, request: { state: 'PAID', ...reqWhere, ...paidReqRange } }, _sum: { amountInr: true }, _count: { _all: true } });

    // Dual-approval backlog + aging (by submittedAt, IST days)
    const pending = await this.prisma.client.payoutRequest.findMany({ where: { state: 'PENDING_APPROVALS', ...reqWhere }, select: { submittedAt: true, totalAmountInr: true, approvals: { select: { approverRole: true, decision: true } } } });
    const now = Date.now();
    const aging = { d0_7: 0, d8_14: 0, d15_30: 0, d31plus: 0 };
    let awaitingManager = 0;
    let awaitingAdmin = 0;
    for (const r of pending) {
      const age = Math.floor((now - r.submittedAt.getTime()) / DAY);
      if (age <= 7) aging.d0_7 += 1;
      else if (age <= 14) aging.d8_14 += 1;
      else if (age <= 30) aging.d15_30 += 1;
      else aging.d31plus += 1;
      if (!r.approvals.some((a) => a.approverRole === 'MANAGER' && a.decision === 'APPROVED')) awaitingManager += 1;
      if (!r.approvals.some((a) => a.approverRole === 'ADMIN' && a.decision === 'APPROVED')) awaitingAdmin += 1;
    }
    const missingProof = await this.prisma.client.payoutRequest.count({ where: { state: 'PAYMENT_RECORDED_PENDING_PROOF', ...reqWhere } });
    const exceptions = await this.exceptionItems(advisors, q.bankId);
    const byKind: Record<string, number> = {};
    for (const e of exceptions) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    return {
      totals,
      confirmedTransfers: { count: confirmed._count._all, amountInr: Number(confirmed._sum.amountInr ?? 0) },
      approvals: { pendingCount: pending.length, pendingAmountInr: pending.reduce((a, r) => a + Number(r.totalAmountInr), 0), awaitingManager, awaitingAdmin, aging },
      missingProof,
      exceptions: { total: exceptions.length, byKind, items: exceptions.slice(0, 100) },
      meta: { dateBasis: q.dateBasis, from: q.from ?? null, to: q.to ?? null, staleDays: this.staleDays(), scope: advisors ? { advisorCount: advisors.length } : 'ALL', asOf: new Date().toISOString(), source: 'KBS payout ledger (entitlements from applied bank MIS; payments recorded by Accounts)' },
    };
  }

  private staleDays() {
    return this.config.getInt('payouts.requestStaleDays') ?? 30;
  }

  async exceptions(actor: Actor, q: Pick<PayoutDashboardQuery, 'managerId' | 'advisorId' | 'bankId'>) {
    const advisors = await this.advisorScope(actor, q);
    return this.exceptionItems(advisors, q.bankId);
  }

  private async exceptionItems(advisors: string[] | null, bankId?: string): Promise<PayoutExceptionItem[]> {
    const who = advisors ? { advisorUserId: { in: advisors } } : {};
    const onBank = bankId ? { items: { some: { active: true, entitlement: { bankId } } } } : {};
    const reqSel = { id: true, publicRef: true, state: true, totalAmountInr: true, submittedAt: true, holdReason: true, heldAt: true, advisor: { select: { id: true, fullName: true } } } as const;
    const out: PayoutExceptionItem[] = [];
    const view = (r: { id: string; publicRef: string; state: string; advisor: { id: string; fullName: string } }) => ({ request: { id: r.id, publicRef: r.publicRef, state: r.state }, advisor: r.advisor });

    // payment-level exceptions (amount mismatch, post-payment flags) — resolved through F-605 corrections/resolve
    for (const p of await this.prisma.client.externalPayment.findMany({ where: { state: 'EXCEPTION', request: { ...who, ...onBank } }, include: { request: { select: reqSel } }, orderBy: { createdAt: 'asc' } }))
      out.push({ kind: 'PAYMENT_EXCEPTION', subjectId: p.id, ...view(p.request), amountInr: Number(p.amountInr), detail: p.exceptionReason ?? 'Payment exception', raisedAt: (p.exceptionRaisedAt ?? p.createdAt).toISOString(), acknowledgeable: false, resolvedVia: p.request.state === 'PAID' ? 'Admin resolves on the request' : 'Accounts proposes a correction; Admin approves' });
    for (const p of await this.prisma.client.externalPayment.findMany({ where: { state: 'CORRECTION_PENDING', request: { ...who, ...onBank } }, include: { request: { select: reqSel } } }))
      out.push({ kind: 'CORRECTION_PENDING', subjectId: p.id, ...view(p.request), amountInr: Number(p.amountInr), detail: `Correction awaiting Admin: ${p.correctionReason ?? ''}`, raisedAt: p.createdAt.toISOString(), acknowledgeable: false, resolvedVia: 'Admin approves or rejects the correction' });
    for (const r of await this.prisma.client.payoutRequest.findMany({ where: { state: 'ON_HOLD', ...who, ...onBank, payments: { none: { state: { in: [...LIVE] } } } }, select: reqSel }))
      out.push({ kind: 'DISCREPANCY_HOLD', subjectId: r.id, ...view(r), amountInr: Number(r.totalAmountInr), detail: r.holdReason ?? 'Returned to Admin', raisedAt: (r.heldAt ?? r.submittedAt).toISOString(), acknowledgeable: false, resolvedVia: 'Admin releases the hold or cancels the request' });
    for (const r of await this.prisma.client.payoutRequest.findMany({ where: { state: 'PAYMENT_RECORDED_PENDING_PROOF', ...who, ...onBank }, select: reqSel }))
      out.push({ kind: 'MISSING_PROOF', subjectId: r.id, ...view(r), amountInr: Number(r.totalAmountInr), detail: 'Payment recorded; proof not yet attached, so the request is not Paid', raisedAt: r.submittedAt.toISOString(), acknowledgeable: false, resolvedVia: 'Accounts attaches the proof' });

    const resolved = await this.prisma.client.payoutExceptionResolution.findMany({ select: { kind: true, subjectId: true } });
    const done = new Set(resolved.map((x) => `${x.kind}:${x.subjectId}`));
    const cutoff = new Date(Date.now() - this.staleDays() * DAY);
    for (const r of await this.prisma.client.payoutRequest.findMany({ where: { state: 'PENDING_APPROVALS', submittedAt: { lt: cutoff }, ...who, ...onBank }, select: reqSel })) {
      if (done.has(`STALE_REQUEST:${r.id}`)) continue;
      out.push({ kind: 'STALE_REQUEST', subjectId: r.id, ...view(r), amountInr: Number(r.totalAmountInr), detail: `Awaiting approvals for more than ${this.staleDays()} days (not auto-cancelled)`, raisedAt: r.submittedAt.toISOString(), acknowledgeable: true, resolvedVia: null });
    }
    // MIS correction after payment (F-602 writes a PAID→PAID event); never un-paid, never clawed back
    const corrections = await this.prisma.client.payoutEntitlementEvent.findMany({
      where: { fromState: 'PAID', toState: 'PAID', reason: { startsWith: 'Correction after payment' }, entitlement: { ...who, ...(bankId ? { bankId } : {}) } },
      include: { entitlement: { select: { amountInr: true, currentRequestId: true, advisor: { select: { id: true, fullName: true } } } } },
      orderBy: { at: 'asc' },
    });
    const reqRefs = new Map((await this.prisma.client.payoutRequest.findMany({ where: { id: { in: corrections.map((c) => c.entitlement.currentRequestId).filter((x): x is string => Boolean(x)) } }, select: { id: true, publicRef: true, state: true } })).map((r) => [r.id, r]));
    for (const c of corrections) {
      if (done.has(`MIS_CORRECTION_AFTER_PAYMENT:${c.id}`)) continue;
      out.push({ kind: 'MIS_CORRECTION_AFTER_PAYMENT', subjectId: c.id, request: c.entitlement.currentRequestId ? (reqRefs.get(c.entitlement.currentRequestId) ?? null) : null, advisor: c.entitlement.advisor, amountInr: Number(c.entitlement.amountInr), detail: c.reason ?? 'Bank MIS changed after payment', raisedAt: c.at.toISOString(), acknowledgeable: true, resolvedVia: null });
    }
    // entitlement moved UNDER_REVIEW while inside an open request (MIS correction before payment)
    for (const e of await this.prisma.client.payoutEntitlement.findMany({ where: { state: 'UNDER_REVIEW', ...who, ...(bankId ? { bankId } : {}), requestItems: { some: { active: true, request: { state: { notIn: [...TERMINAL, 'PAID'] as never[] } } } } }, include: { advisor: { select: { id: true, fullName: true } }, requestItems: { where: { active: true }, take: 1, include: { request: { select: { id: true, publicRef: true, state: true } } } } } }))
      out.push({ kind: 'UNDER_REVIEW_IN_REQUEST', subjectId: e.id, request: e.requestItems[0]?.request ?? null, advisor: e.advisor, amountInr: Number(e.amountInr), detail: e.reviewReason ?? 'Bank MIS no longer reports the trigger value', raisedAt: e.updatedAt.toISOString(), acknowledgeable: false, resolvedVia: 'Wait for the next MIS batch, or Admin cancels the request' });
    return out.sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
  }

  /** Acknowledge a derived exception with a reason (audited). Payment exceptions resolve through the F-605 flows instead. */
  async resolve(actor: Actor, body: ResolvePayoutExceptionBody) {
    if (actor.role !== 'ADMIN' && actor.role !== 'ACCOUNTS') throw new AppError('RBAC_FORBIDDEN', 'Only Admin or Accounts resolves payout exceptions.');
    const open = (await this.exceptionItems(null)).find((e) => e.kind === body.kind && e.subjectId === body.subjectId);
    if (!open) throw new AppError('PAYOUT_STATE_INVALID', 'This exception is not open (already resolved or no longer applies).');
    try {
      const row = await this.prisma.client.payoutExceptionResolution.create({ data: { kind: body.kind, subjectId: body.subjectId, resolvedByUserId: actor.userId, reason: body.reason } });
      RequestContextStore.audit({ entityId: body.subjectId, after: { kind: body.kind, resolutionId: row.id, amountInr: open.amountInr }, reason: body.reason });
      return { id: row.id, kind: row.kind, subjectId: row.subjectId, reason: row.reason, resolvedAt: row.resolvedAt.toISOString(), summary: `${open.detail}${open.amountInr !== null ? ` (${formatInr(open.amountInr)})` : ''}` };
    } catch (e) {
      if (e instanceof Error && e.message.includes('PayoutExceptionResolution_kind_subjectId_key')) throw new AppError('CONFLICT', 'Already resolved.');
      throw e;
    }
  }

  async resolutions() {
    const rows = await this.prisma.client.payoutExceptionResolution.findMany({ orderBy: { resolvedAt: 'desc' }, take: 100, include: { resolvedBy: { select: { id: true, fullName: true } } } });
    return rows.map((r) => ({ id: r.id, kind: r.kind, subjectId: r.subjectId, reason: r.reason, resolvedAt: r.resolvedAt.toISOString(), resolvedBy: r.resolvedBy }));
  }
}
