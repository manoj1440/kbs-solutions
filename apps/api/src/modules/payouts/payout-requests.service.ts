import type { CreatePayoutRequestBody, LedgerPosition, PayoutApprovalBody, PayoutRequestListQuery } from '@kbs/shared';
import { makePublicRef, maskTransferReference, RefPrefix } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HierarchyService } from '../users/hierarchy.service';

import { PayoutEligibilityService } from './eligibility.service';
import { PAYMENT_QUEUE_WHERE } from './payment-queues';

const requestInclude = {
  advisor: { select: { id: true, fullName: true } },
  items: { where: { active: true }, include: { entitlement: { include: { lead: { select: { id: true, publicRef: true, customerFullName: true } }, bank: { select: { code: true, displayName: true } }, card: { select: { name: true } }, rule: { select: { name: true, triggerField: true } }, evidenceBatch: { select: { publicRef: true, uploadedAt: true } } } } } },
  approvals: { include: { approver: { select: { id: true, fullName: true, role: true } } }, orderBy: { at: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const }, include: { recordedBy: { select: { id: true, fullName: true } } } },
} as const;

const LIVE = ['RECORDED', 'PROOF_PENDING', 'VERIFIED', 'EXCEPTION'];
type PaymentRow = { id: string; state: string; paidAt: Date; amountInr: unknown; transferReference: string; method: string | null; proofFileId: string | null; proofAttachedAt: Date | null; recordedBy: { id: string; fullName: string }; createdAt: Date; exceptionReason: string | null; exceptionRaisedAt: Date | null; resolutionNote: string | null; resolvedAt: Date | null; correctionOfId: string | null; correctionReason: string | null; correctionDecidedAt: Date | null; correctionDecidedByUserId: string | null; correctionDecisionReason: string | null; supersededAt: Date | null };

/**
 * F-603 — Advisor ledger + request creation with atomic reservation (REQ-17 §17.2–§17.3, INV-06, ADR-008).
 * F-604 — dual approval (Manager + Admin as two distinct records), rejection releases items, cancel authority.
 * The partial unique index `PayoutRequestItem_one_active_per_entitlement_idx` is the last line of defence.
 */
@Injectable()
export class PayoutRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
    private readonly eligibility: PayoutEligibilityService,
  ) {}

  // ── ledger (REQ-17 §17.2, §17.8 vocabulary) ──
  static position(entState: string, req: { state: string; approvals: { approverRole: string; decision: string }[] } | null): LedgerPosition {
    switch (entState) {
      case 'PENDING_HOLD':
        return 'Pending hold';
      case 'ELIGIBLE_AVAILABLE':
        return 'Available for claim';
      case 'UNDER_REVIEW':
        return 'Under review';
      case 'VOID':
        return 'Void';
      case 'PAID':
        return 'Paid';
      case 'RESERVED': {
        if (!req) return 'Request submitted';
        if (req.state === 'APPROVED') return 'Both approved / Accounts payment pending';
        if (req.state === 'PAYMENT_RECORDED_PENDING_PROOF') return 'Payment recorded / proof pending';
        if (req.state === 'ON_HOLD') return 'On hold';
        const has = (r: string) => req.approvals.some((a) => a.approverRole === r && a.decision === 'APPROVED');
        if (!has('MANAGER')) return 'Manager approval pending';
        if (!has('ADMIN')) return 'Admin approval pending';
        return 'Request submitted';
      }
      default:
        return 'Request submitted';
    }
  }

  async ledger(actor: Actor, advisorUserId = actor.userId) {
    if (advisorUserId !== actor.userId) {
      const ok = actor.role === 'ADMIN' || actor.role === 'ACCOUNTS' || (actor.role === 'MANAGER' && actor.teamUserIds.includes(advisorUserId));
      if (!ok) throw AppError.notFound('Ledger');
    }
    await this.eligibility.releaseHolds({ advisorUserId });
    const ents = await this.prisma.client.payoutEntitlement.findMany({
      where: { advisorUserId },
      orderBy: [{ eligibleAt: 'desc' }],
      include: {
        lead: { select: { id: true, publicRef: true, customerFullName: true, linkages: { where: { supersededAt: null }, take: 1, select: { referenceKind: true, referenceValue: true, verificationStatus: true } }, statusSnapshot: { select: { lastMatchedAt: true } } } },
        bank: { select: { code: true, displayName: true } },
        card: { select: { name: true } },
        rule: { select: { name: true, triggerField: true } },
        evidenceBatch: { select: { publicRef: true, uploadedAt: true } },
        requestItems: { where: { active: true }, take: 1, include: { request: { select: { id: true, publicRef: true, state: true, submittedAt: true, approvals: { select: { approverRole: true, decision: true } } } } } },
      },
    });
    const rows = ents.map((e) => {
      const req = e.requestItems[0]?.request ?? null;
      const position = PayoutRequestsService.position(e.state, req);
      return {
        entitlementId: e.id,
        state: e.state,
        position,
        kbsRef: e.lead.publicRef,
        customer: e.lead.customerFullName,
        leadId: e.lead.id,
        bank: e.bank,
        card: e.card.name,
        bankReference: e.lead.linkages[0] ? { kind: e.lead.linkages[0].referenceKind, value: e.lead.linkages[0].referenceValue, status: e.lead.linkages[0].verificationStatus } : null,
        lastMatchedAt: e.lead.statusSnapshot?.lastMatchedAt.toISOString() ?? null,
        rawActivation: e.triggerFieldValue,
        triggerField: e.rule.triggerField,
        payableUnderRule: { name: e.rule.name, version: e.ruleVersion },
        amountInr: Number(e.amountInr),
        eligibleAt: e.eligibleAt.toISOString(),
        evidence: { batchRef: e.evidenceBatch.publicRef, uploadedAt: e.evidenceBatch.uploadedAt.toISOString() },
        request: req ? { id: req.id, publicRef: req.publicRef, state: req.state, submittedAt: req.submittedAt.toISOString() } : null,
        reviewReason: e.reviewReason,
      };
    });
    const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((a, r) => ({ count: a.count + 1, amountInr: a.amountInr + r.amountInr }), { count: 0, amountInr: 0 });
    const totals = {
      eligible: sum((r) => ['PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED', 'PAID'].includes(r.state)),
      available: sum((r) => r.state === 'ELIGIBLE_AVAILABLE'),
      requested: sum((r) => r.state === 'RESERVED' && r.request?.state === 'PENDING_APPROVALS'),
      approvedUnpaid: sum((r) => r.state === 'RESERVED' && (r.request?.state === 'APPROVED' || r.request?.state === 'PAYMENT_RECORDED_PENDING_PROOF')),
      paid: sum((r) => r.state === 'PAID'),
      underReview: sum((r) => r.state === 'UNDER_REVIEW'),
      pendingHold: sum((r) => r.state === 'PENDING_HOLD'),
    };
    return { advisorUserId, rows, totals, asOf: new Date().toISOString() };
  }

  // ── F-603 request creation (atomic reservation) ──
  async create(actor: Actor, body: CreatePayoutRequestBody, idempotencyKey: string) {
    if (actor.role !== 'ADVISOR') throw new AppError('RBAC_FORBIDDEN', 'Only Advisors request payouts.');
    const existing = await this.prisma.client.payoutRequest.findUnique({ where: { idempotencyKey }, select: { id: true } });
    if (existing) return this.get(actor, existing.id);
    await this.eligibility.releaseHolds({ advisorUserId: actor.userId });
    // approver resolution (REQ-17 §17.4): current Manager, else the designated approver; never skipped (PAY-04)
    const parentId = await this.hierarchy.currentParentId(actor.userId);
    const parent = parentId ? await this.prisma.client.user.findUnique({ where: { id: parentId }, select: { id: true, role: true, status: true } }) : null;
    let managerApproverUserId: string | null = parent && parent.role === 'MANAGER' && parent.status === 'ACTIVE' ? parent.id : null;
    if (!managerApproverUserId) {
      const designated = this.config.getString('payouts.designatedApproverManagerUserId');
      const d = designated ? await this.prisma.client.user.findUnique({ where: { id: designated }, select: { id: true, role: true, status: true } }) : null;
      if (!d || d.role !== 'MANAGER' || d.status !== 'ACTIVE') throw new AppError('CONFIG_MISSING', 'No Manager approver is configured for Advisors reporting directly to Admin (payouts.designatedApproverManagerUserId). The request cannot be created until KBS designates one.');
      managerApproverUserId = d.id;
    }
    const created = await this.prisma.client.$transaction(async (tx) => {
      // lock the candidate rows; anything not ELIGIBLE_AVAILABLE for this advisor refuses the whole request
      const locked = await tx.$queryRaw<Array<{ id: string; state: string }>>`SELECT id, state::text FROM "PayoutEntitlement" WHERE "advisorUserId" = ${actor.userId} AND (${body.all === true} OR id = ANY(${body.entitlementIds ?? []}::text[])) FOR UPDATE`;
      const wanted = body.all ? locked.filter((l) => l.state === 'ELIGIBLE_AVAILABLE').map((l) => l.id) : (body.entitlementIds ?? []);
      if (!wanted.length) throw new AppError('PAYOUT_ENTITLEMENT_NOT_AVAILABLE', 'Nothing is available to claim.');
      const byId = new Map(locked.map((l) => [l.id, l.state]));
      const bad = wanted.filter((id) => byId.get(id) !== 'ELIGIBLE_AVAILABLE');
      if (bad.length) throw new AppError('PAYOUT_ENTITLEMENT_NOT_AVAILABLE', `${bad.length} selected card event(s) are not available (already reserved, paid, on hold or under review). Nothing was reserved.`, { entitlementIds: bad });
      const ents = await tx.payoutEntitlement.findMany({ where: { id: { in: wanted } }, include: { lead: { select: { publicRef: true, customerFullName: true } }, bank: { select: { code: true } }, card: { select: { name: true } }, rule: { select: { name: true, triggerField: true } }, evidenceBatch: { select: { publicRef: true } } } });
      const total = ents.reduce((a, e) => a + Number(e.amountInr), 0);
      const snapshot = {
        advisorUserId: actor.userId,
        managerApproverUserId,
        reportingParentSnapshot: parentId,
        submittedAt: new Date().toISOString(),
        items: ents.map((e) => ({ entitlementId: e.id, eventKey: e.eventKey, kbsRef: e.lead.publicRef, customer: e.lead.customerFullName, bank: e.bank.code, card: e.card.name, triggerField: e.rule.triggerField, triggerFieldValue: e.triggerFieldValue, rule: { id: e.ruleId, name: e.rule.name, version: e.ruleVersion }, rateId: e.rateId, amountInr: Number(e.amountInr), evidenceBatchRef: e.evidenceBatch.publicRef, eligibleAt: e.eligibleAt.toISOString() })),
      };
      const req = await tx.payoutRequest.create({ data: { publicRef: makePublicRef(RefPrefix.PAYOUT_REQUEST), advisorUserId: actor.userId, managerApproverUserId, itemCount: ents.length, totalAmountInr: total, snapshot, idempotencyKey } });
      await tx.payoutRequestItem.createMany({ data: ents.map((e) => ({ requestId: req.id, entitlementId: e.id, amountSnapshotInr: e.amountInr })) });
      await tx.payoutEntitlement.updateMany({ where: { id: { in: wanted } }, data: { state: 'RESERVED', currentRequestId: req.id } });
      await tx.payoutEntitlementEvent.createMany({ data: wanted.map((id) => ({ entitlementId: id, fromState: 'ELIGIBLE_AVAILABLE' as const, toState: 'RESERVED' as const, requestId: req.id, actorUserId: actor.userId, reason: `reserved by ${req.publicRef}` })) });
      await tx.outboxEvent.create({ data: { type: 'payouts.request.submitted', payload: { requestId: req.id, jobId: `payouts.request.submitted:${req.id}` } } });
      return req;
    });
    RequestContextStore.audit({ entityId: created.id, after: { publicRef: created.publicRef, itemCount: created.itemCount, totalAmountInr: Number(created.totalAmountInr), managerApproverUserId } });
    const adminId = await this.hierarchy.adminUserId();
    const body_ = `${created.publicRef}: ${created.itemCount} card event(s), ₹${Number(created.totalAmountInr).toLocaleString('en-IN')}. Awaiting Manager and Admin approval.`;
    await this.notifications.notify({ recipientUserId: managerApproverUserId, kind: 'PAYOUT_APPROVAL_REQUIRED', title: 'Payout request needs your approval', body: body_, deepLink: { entityType: 'PayoutRequest', entityId: created.id }, dedupeKey: `payout:approval:${created.id}:manager` });
    await this.notifications.notify({ recipientUserId: adminId, kind: 'PAYOUT_APPROVAL_REQUIRED', title: 'Payout request needs Admin approval', body: body_, deepLink: { entityType: 'PayoutRequest', entityId: created.id }, dedupeKey: `payout:approval:${created.id}:admin` });
    await this.notifications.notify({ recipientUserId: actor.userId, kind: 'PAYOUT_SUBMITTED', title: 'Payout request submitted', body: `${body_} A submitted request is not yet an approval.`, deepLink: { entityType: 'PayoutRequest', entityId: created.id }, dedupeKey: `payout:submitted:${created.id}` });
    return this.get(actor, created.id);
  }

  private canSee(actor: Actor, r: { advisorUserId: string; managerApproverUserId: string }) {
    return actor.role === 'ADMIN' || actor.role === 'ACCOUNTS' || r.advisorUserId === actor.userId || r.managerApproverUserId === actor.userId || (actor.role === 'MANAGER' && actor.teamUserIds.includes(r.advisorUserId));
  }

  async get(actor: Actor, id: string) {
    const r = await this.prisma.client.payoutRequest.findUnique({ where: { id }, include: requestInclude });
    if (!r || !this.canSee(actor, r)) throw AppError.notFound('Payout request');
    return this.view(r, actor);
  }

  private async view(r: NonNullable<Awaited<ReturnType<typeof this.prisma.client.payoutRequest.findUnique<{ where: { id: string }; include: typeof requestInclude }>>>>, actor: Actor) {
    const approver = await this.prisma.client.user.findUnique({ where: { id: r.managerApproverUserId }, select: { id: true, fullName: true } });
    const manager = r.approvals.find((a) => a.approverRole === 'MANAGER') ?? null;
    const admin = r.approvals.find((a) => a.approverRole === 'ADMIN') ?? null;
    const outstanding = r.state === 'PENDING_APPROVALS' ? (['MANAGER', 'ADMIN'] as const).filter((role) => !r.approvals.some((a) => a.approverRole === role && a.decision === 'APPROVED')) : [];
    const order = this.config.getString('payouts.approvalOrder') ?? 'ANY';
    const myRole = actor.role === 'ADMIN' ? 'ADMIN' : actor.userId === r.managerApproverUserId ? 'MANAGER' : null;
    const canApprove = r.state === 'PENDING_APPROVALS' && myRole !== null && !r.approvals.some((a) => a.approverRole === myRole) && !(myRole === 'ADMIN' && order === 'MANAGER_FIRST' && !manager) && !(myRole === 'MANAGER' && manager !== null);
    // prior requests / payments for the same leads (REQ-17 §17.4 evidence)
    const leadIds = r.items.map((i) => i.entitlement.leadId);
    const prior = leadIds.length ? await this.prisma.client.payoutRequestItem.findMany({ where: { entitlement: { leadId: { in: leadIds } }, requestId: { not: r.id } }, include: { request: { select: { id: true, publicRef: true, state: true, submittedAt: true } }, entitlement: { select: { leadId: true } } } }) : [];
    return {
      id: r.id,
      publicRef: r.publicRef,
      state: r.state,
      advisor: r.advisor,
      managerApprover: approver,
      itemCount: r.itemCount,
      totalAmountInr: Number(r.totalAmountInr),
      submittedAt: r.submittedAt.toISOString(),
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      cancelReason: r.cancelReason,
      approvals: { manager: manager ? { by: manager.approver, decision: manager.decision, reason: manager.reason, at: manager.at.toISOString() } : null, admin: admin ? { by: admin.approver, decision: admin.decision, reason: admin.reason, at: admin.at.toISOString() } : null, outstanding, order },
      me: { role: myRole, canApprove, canCancel: (actor.role === 'ADMIN' && !['PAID', 'CANCELLED', 'REJECTED'].includes(r.state) && !r.payments.some((p) => LIVE.includes(p.state))) || (r.advisorUserId === actor.userId && r.state === 'PENDING_APPROVALS' && r.approvals.length === 0 && this.config.getBool('payouts.advisorCanCancelBeforeApproval')) },
      items: r.items.map((i) => ({
        id: i.id,
        entitlementId: i.entitlementId,
        amountSnapshotInr: Number(i.amountSnapshotInr),
        entitlementState: i.entitlement.state,
        warnings: [...(i.entitlement.state === 'UNDER_REVIEW' ? ['Entitlement is under review after an MIS correction'] : []), ...(i.entitlement.reviewReason ? [i.entitlement.reviewReason] : [])],
        lead: i.entitlement.lead,
        bank: i.entitlement.bank,
        card: i.entitlement.card.name,
        triggerField: i.entitlement.rule.triggerField,
        triggerFieldValue: i.entitlement.triggerFieldValue,
        rule: { name: i.entitlement.rule.name, version: i.entitlement.ruleVersion },
        evidence: { batchRef: i.entitlement.evidenceBatch.publicRef, uploadedAt: i.entitlement.evidenceBatch.uploadedAt.toISOString() },
        eligibleAt: i.entitlement.eligibleAt.toISOString(),
        priorRequests: prior.filter((p) => p.entitlement.leadId === i.entitlement.leadId).map((p) => ({ id: p.request.id, publicRef: p.request.publicRef, state: p.request.state, submittedAt: p.request.submittedAt.toISOString() })),
      })),
      ...(await this.paymentSection(r, actor)),
      snapshot: r.snapshot,
    };
  }

  /**
   * F-605 payment trace. Admin/Accounts/Manager see every entry (corrections keep the prior one, REQ-18 §18.3);
   * the Advisor sees only a privacy-safe receipt (REQ-18 §18.2). Payee bank summary only for Accounts/Admin.
   */
  private async paymentSection(r: { id: string; state: string; advisorUserId: string; totalAmountInr: unknown; holdReason: string | null; heldAt: Date | null; heldByUserId: string | null; paidAt: Date | null; payments: PaymentRow[] }, actor: Actor) {
    const privileged = actor.role === 'ADMIN' || actor.role === 'ACCOUNTS' || actor.role === 'MANAGER';
    const deciders = [...new Set(r.payments.map((p) => p.correctionDecidedByUserId).filter((x): x is string => Boolean(x)))];
    const names = new Map((deciders.length ? await this.prisma.client.user.findMany({ where: { id: { in: deciders } }, select: { id: true, fullName: true } }) : []).map((u) => [u.id, u]));
    const toView = (p: PaymentRow) => ({
      id: p.id,
      state: p.state,
      paidAt: p.paidAt.toISOString(),
      amountInr: Number(p.amountInr),
      transferReference: p.transferReference,
      method: p.method,
      proofFileId: p.proofFileId,
      proofAttachedAt: p.proofAttachedAt?.toISOString() ?? null,
      recordedBy: p.recordedBy,
      recordedAt: p.createdAt.toISOString(),
      exceptionReason: p.exceptionReason,
      exceptionRaisedAt: p.exceptionRaisedAt?.toISOString() ?? null,
      resolutionNote: p.resolutionNote,
      resolvedAt: p.resolvedAt?.toISOString() ?? null,
      correctionOfId: p.correctionOfId,
      correctionReason: p.correctionReason,
      correctionDecision: p.correctionDecidedAt ? { by: p.correctionDecidedByUserId ? (names.get(p.correctionDecidedByUserId) ?? null) : null, at: p.correctionDecidedAt.toISOString(), reason: p.correctionDecisionReason } : null,
      supersededAt: p.supersededAt?.toISOString() ?? null,
    });
    const live = r.payments.find((p) => LIVE.includes(p.state)) ?? null;
    const pending = r.payments.find((p) => p.state === 'CORRECTION_PENDING') ?? null;
    const proofRequired = this.config.getBool('payouts.proofRequiredForPaid') !== false;
    const acc = actor.role === 'ACCOUNTS';
    const adm = actor.role === 'ADMIN';
    let payee = null;
    if (acc || adm) {
      const p = await this.prisma.client.advisorProfile.findUnique({ where: { userId: r.advisorUserId }, select: { accountHolderName: true, bankName: true, ifsc: true, bankAccountLast4: true, reviewOutcome: true, onboardingStep: true } });
      payee = p ? { accountHolderName: p.accountHolderName, bankName: p.bankName, ifsc: p.ifsc, accountMasked: p.bankAccountLast4 ? `••••••${p.bankAccountLast4}` : null, verified: p.reviewOutcome === 'APPROVED' && p.onboardingStep === 'COMPLETE', canReveal: actor.permissions.includes('SENSITIVE_REVEAL_BANK') } : null;
    }
    return {
      /** Advisor-safe confirmation (every viewer gets it). */
      receipt: live ? { state: live.state, paidAt: live.paidAt.toISOString(), amountInr: Number(live.amountInr), transferReferenceMasked: maskTransferReference(live.transferReference), method: live.method } : null,
      payment: privileged && live ? toView(live) : null,
      pendingCorrection: privileged && pending ? toView(pending) : null,
      paymentHistory: privileged ? r.payments.map(toView) : [],
      paidAt: r.paidAt?.toISOString() ?? null,
      hold: privileged && r.holdReason ? { reason: r.holdReason, at: r.heldAt?.toISOString() ?? null, byUserId: r.heldByUserId } : null,
      payee,
      payments: {
        proofRequired,
        canRecord: acc && r.state === 'APPROVED' && !live,
        canAttachProof: acc && r.state === 'PAYMENT_RECORDED_PENDING_PROOF' && live?.state === 'PROOF_PENDING',
        canCorrect: acc && Boolean(live) && !pending,
        canDecideCorrection: adm && Boolean(pending),
        canFlag: (acc || adm) && ((r.state === 'APPROVED' && !live) || (r.state === 'PAID' && live?.state === 'VERIFIED')),
        canResolve: adm && ((r.state === 'ON_HOLD' && !live) || (r.state === 'PAID' && live?.state === 'EXCEPTION')),
      },
    };
  }

  async list(actor: Actor, q: PayoutRequestListQuery) {
    const scope =
      actor.role === 'ADVISOR' ? { advisorUserId: actor.userId } : actor.role === 'MANAGER' ? { OR: [{ managerApproverUserId: actor.userId }, { advisorUserId: { in: actor.teamUserIds } }] } : actor.role === 'ACCOUNTS' ? { state: { in: ['APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'ON_HOLD'] as never[] } } : {};
    const awaiting = q.awaitingMe ? (actor.role === 'ADMIN' ? { state: 'PENDING_APPROVALS' as const, approvals: { none: { approverRole: 'ADMIN' as const } } } : { state: 'PENDING_APPROVALS' as const, managerApproverUserId: actor.userId, approvals: { none: { approverRole: 'MANAGER' as const } } }) : {};
    const queue = q.queue ? PAYMENT_QUEUE_WHERE[q.queue] : {};
    const where = { AND: [scope, awaiting, queue, q.state ? { state: q.state } : {}, q.advisorId ? { advisorUserId: q.advisorId } : {}] };
    const [rows, total] = await Promise.all([
      this.prisma.client.payoutRequest.findMany({ where, orderBy: { submittedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { advisor: { select: { id: true, fullName: true } }, approvals: { select: { approverRole: true, decision: true, at: true } }, payments: { select: { state: true, paidAt: true, amountInr: true }, orderBy: { createdAt: 'asc' } } } }),
      this.prisma.client.payoutRequest.count({ where }),
    ]);
    return new Paginated(
      rows.map((r) => ({ id: r.id, publicRef: r.publicRef, state: r.state, advisor: r.advisor, itemCount: r.itemCount, totalAmountInr: Number(r.totalAmountInr), submittedAt: r.submittedAt.toISOString(), approvals: r.approvals.map((a) => ({ role: a.approverRole, decision: a.decision, at: a.at.toISOString() })), outstanding: r.state === 'PENDING_APPROVALS' ? ['MANAGER', 'ADMIN'].filter((role) => !r.approvals.some((a) => a.approverRole === role && a.decision === 'APPROVED')) : [], holdReason: actor.role === 'ADVISOR' ? null : r.holdReason, paidAt: r.paidAt?.toISOString() ?? null, payment: ((p) => (p ? { state: p.state, paidAt: p.paidAt.toISOString(), amountInr: Number(p.amountInr) } : null))(r.payments.find((p) => LIVE.includes(p.state))), correctionPending: r.payments.some((p) => p.state === 'CORRECTION_PENDING') })),
      q.page,
      q.pageSize,
      total,
    );
  }

  // ── F-604 dual approval ──
  async decide(actor: Actor, id: string, body: PayoutApprovalBody) {
    const r = await this.prisma.client.payoutRequest.findUnique({ where: { id }, include: { approvals: true, items: { where: { active: true }, select: { entitlementId: true } } } });
    if (!r || !this.canSee(actor, r)) throw AppError.notFound('Payout request');
    if (r.state !== 'PENDING_APPROVALS') throw new AppError('PAYOUT_STATE_INVALID', `Request is ${r.state}; approvals are closed.`);
    const role: 'MANAGER' | 'ADMIN' | null = actor.role === 'ADMIN' ? 'ADMIN' : actor.userId === r.managerApproverUserId ? 'MANAGER' : null;
    if (!role) throw new AppError('RBAC_FORBIDDEN', 'Only the assigned Manager approver or the Admin can decide this request.');
    if (r.advisorUserId === actor.userId) throw new AppError('RBAC_FORBIDDEN', 'You cannot approve your own request.');
    if (r.approvals.some((a) => a.approverUserId === actor.userId)) throw new AppError('PAYOUT_APPROVAL_DUPLICATE', 'You have already recorded a decision on this request; one person never holds both approvals.');
    if (r.approvals.some((a) => a.approverRole === role)) throw new AppError('PAYOUT_APPROVAL_DUPLICATE', `${role} approval already recorded.`);
    if (role === 'ADMIN' && (this.config.getString('payouts.approvalOrder') ?? 'ANY') === 'MANAGER_FIRST' && !r.approvals.some((a) => a.approverRole === 'MANAGER')) throw new AppError('PAYOUT_STATE_INVALID', 'Manager approval is required first (payouts.approvalOrder = MANAGER_FIRST).');
    const entitlementIds = r.items.map((i) => i.entitlementId);
    const outcome = await this.prisma.client.$transaction(async (tx) => {
      await tx.payoutApproval.create({ data: { requestId: id, approverRole: role, approverUserId: actor.userId, decision: body.decision, reason: body.reason ?? null } });
      if (body.decision === 'REJECTED') {
        await tx.payoutRequest.update({ where: { id }, data: { state: 'REJECTED' } });
        await tx.payoutRequestItem.updateMany({ where: { requestId: id, active: true }, data: { active: false } });
        await tx.payoutEntitlement.updateMany({ where: { id: { in: entitlementIds }, state: 'RESERVED' }, data: { state: 'ELIGIBLE_AVAILABLE', currentRequestId: null } });
        await tx.payoutEntitlementEvent.createMany({ data: entitlementIds.map((e) => ({ entitlementId: e, fromState: 'RESERVED' as const, toState: 'ELIGIBLE_AVAILABLE' as const, requestId: id, actorUserId: actor.userId, reason: `released: ${role} rejected ${r.publicRef} — ${body.reason ?? ''}` })) });
        return 'REJECTED' as const;
      }
      const all = await tx.payoutApproval.findMany({ where: { requestId: id, decision: 'APPROVED' } });
      const both = all.some((a) => a.approverRole === 'MANAGER') && all.some((a) => a.approverRole === 'ADMIN');
      if (both) {
        await tx.payoutRequest.update({ where: { id }, data: { state: 'APPROVED' } });
        await tx.outboxEvent.create({ data: { type: 'payouts.request.approved', payload: { requestId: id, jobId: `payouts.request.approved:${id}` } } });
      }
      return both ? ('APPROVED' as const) : ('PENDING_APPROVALS' as const);
    });
    RequestContextStore.audit({ entityId: id, before: { state: 'PENDING_APPROVALS' }, after: { state: outcome, role, decision: body.decision }, reason: body.reason });
    const amount = `₹${Number(r.totalAmountInr).toLocaleString('en-IN')}`;
    if (outcome === 'REJECTED') {
      await this.notifications.notify({ recipientUserId: r.advisorUserId, kind: 'PAYOUT_DECISION', title: 'Payout request rejected', body: `${r.publicRef} (${amount}) was rejected by ${role.toLowerCase()}: ${body.reason}. The card events are available to request again.`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:decision:${id}:${role}` });
    } else if (outcome === 'APPROVED') {
      await this.notifications.notify({ recipientUserId: r.advisorUserId, kind: 'PAYOUT_DECISION', title: 'Payout request approved by both approvers', body: `${r.publicRef} (${amount}) is approved and queued for Accounts payment. Approval is not yet payment.`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:decision:${id}:both` });
      for (const acct of await this.prisma.client.user.findMany({ where: { role: 'ACCOUNTS', status: 'ACTIVE' }, select: { id: true } })) {
        await this.notifications.notify({ recipientUserId: acct.id, kind: 'PAYOUT_READY_FOR_PAYMENT', title: 'Payout ready for payment', body: `${r.publicRef} (${amount}) has both approvals.`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:ready:${id}:${acct.id}` });
      }
    } else {
      await this.notifications.notify({ recipientUserId: r.advisorUserId, kind: 'PAYOUT_DECISION', title: `${role === 'MANAGER' ? 'Manager' : 'Admin'} approved`, body: `${r.publicRef}: ${role.toLowerCase()} approval recorded; ${role === 'MANAGER' ? 'Admin' : 'Manager'} approval still outstanding.`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:decision:${id}:${role}` });
    }
    return this.get(actor, id);
  }

  /** Advisor: before any approval (config); Admin: any time before PAID. Releases items. */
  async cancel(actor: Actor, id: string, reason: string) {
    const r = await this.prisma.client.payoutRequest.findUnique({ where: { id }, include: { approvals: true, payments: { select: { id: true, state: true } }, items: { where: { active: true }, select: { entitlementId: true } } } });
    if (!r || !this.canSee(actor, r)) throw AppError.notFound('Payout request');
    if (['PAID', 'CANCELLED', 'REJECTED'].includes(r.state)) throw new AppError('PAYOUT_STATE_INVALID', `Request is ${r.state}.`);
    const isAdvisor = r.advisorUserId === actor.userId;
    if (actor.role !== 'ADMIN' && !isAdvisor) throw new AppError('RBAC_FORBIDDEN', 'Only the requesting Advisor or the Admin can cancel.');
    if (isAdvisor && actor.role !== 'ADMIN') {
      if (!this.config.getBool('payouts.advisorCanCancelBeforeApproval')) throw new AppError('RBAC_FORBIDDEN', 'Advisor cancellation is disabled.');
      if (r.state !== 'PENDING_APPROVALS' || r.approvals.length > 0) throw new AppError('PAYOUT_STATE_INVALID', 'The request already has an approval decision; ask Admin to cancel.');
    }
    if (r.payments.some((p) => LIVE.includes(p.state))) throw new AppError('PAYOUT_STATE_INVALID', 'A payment record exists; resolve it as an exception instead.');
    const entitlementIds = r.items.map((i) => i.entitlementId);
    await this.prisma.client.$transaction([
      this.prisma.client.payoutRequest.update({ where: { id }, data: { state: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: actor.userId, cancelReason: reason } }),
      this.prisma.client.payoutRequestItem.updateMany({ where: { requestId: id, active: true }, data: { active: false } }),
      this.prisma.client.payoutEntitlement.updateMany({ where: { id: { in: entitlementIds }, state: 'RESERVED' }, data: { state: 'ELIGIBLE_AVAILABLE', currentRequestId: null } }),
      this.prisma.client.payoutEntitlementEvent.createMany({ data: entitlementIds.map((e) => ({ entitlementId: e, fromState: 'RESERVED' as const, toState: 'ELIGIBLE_AVAILABLE' as const, requestId: id, actorUserId: actor.userId, reason: `released: ${r.publicRef} cancelled — ${reason}` })) }),
    ]);
    RequestContextStore.audit({ entityId: id, before: { state: r.state }, after: { state: 'CANCELLED' }, reason });
    if (!isAdvisor) await this.notifications.notify({ recipientUserId: r.advisorUserId, kind: 'PAYOUT_DECISION', title: 'Payout request cancelled by Admin', body: `${r.publicRef}: ${reason}. The card events are available again.`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:cancel:${id}` });
    return this.get(actor, id);
  }
}
