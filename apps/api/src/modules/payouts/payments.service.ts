import type { AttachPaymentProofBody, CorrectPaymentBody, PaymentCorrectionDecisionBody, RecordPaymentBody } from '@kbs/shared';
import { formatInr, maskTransferReference, transferReferenceKey } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HierarchyService } from '../users/hierarchy.service';

import { PAYMENT_QUEUE_WHERE } from './payment-queues';
import { PayoutRequestsService } from './payout-requests.service';

type Tx = Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0];

/** Payment entries that count as "the" payment of a request (one at most — partial unique index). */
export const LIVE_PAYMENT_STATES = ['RECORDED', 'PROOF_PENDING', 'VERIFIED', 'EXCEPTION'] as const;

const paise = (v: number | { toString(): string }) => Math.round(Number(v) * 100);

/** Outcome of evaluating a (new or corrected) payment entry against the approved request (REQ-17 §17.7, REQ-18 §18.3). */
type Evaluation = { payment: 'EXCEPTION'; reason: string } | { payment: 'PROOF_PENDING' } | { payment: 'VERIFIED' };

/**
 * F-605 — Accounts records a transfer made **outside KBS** (REQ-17 §17.6). Nothing here moves money.
 * Paid only when amount = approved amount and the required proof is attached; a mismatch is held for Admin review
 * (REQ-18 §18.3: one approved request is either unpaid or fully paid). Corrections append a new entry that Admin
 * must approve; the prior entry is retained as SUPERSEDED.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
    private readonly requests: PayoutRequestsService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
  ) {}

  private proofRequired() {
    return this.config.getBool('payouts.proofRequiredForPaid') !== false;
  }

  private evaluate(amountInr: number, approvedInr: number, hasProof: boolean): Evaluation {
    if (paise(amountInr) !== paise(approvedInr)) return { payment: 'EXCEPTION', reason: `Amount mismatch: recorded ${formatInr(amountInr)}, approved ${formatInr(approvedInr)}. Partial or excess payments are held for Admin review.` };
    if (!hasProof && this.proofRequired()) return { payment: 'PROOF_PENDING' };
    return { payment: 'VERIFIED' };
  }

  /** Row lock on the request so concurrent recordings/corrections serialise. */
  private async lockRequest(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM "PayoutRequest" WHERE id = ${id} FOR UPDATE`;
    const r = await tx.payoutRequest.findUnique({ where: { id }, include: { payments: { orderBy: { createdAt: 'asc' } }, items: { where: { active: true }, select: { entitlementId: true } } } });
    if (!r) throw AppError.notFound('Payout request');
    return r;
  }

  private async assertReferenceFree(tx: Tx, key: string, requestId: string) {
    const clash = await tx.externalPayment.findFirst({ where: { transferReferenceKey: key, requestId: { not: requestId }, state: { in: [...LIVE_PAYMENT_STATES, 'CORRECTION_PENDING'] } }, include: { request: { select: { publicRef: true } } } });
    if (clash) throw new AppError('PAYOUT_DUPLICATE_TRANSFER_REFERENCE', `This transfer reference is already recorded against ${clash.request.publicRef}. One bank transaction can settle only one request.`);
  }

  /** Proof must be a PAYMENT_PROOF upload by Accounts/Admin, not infected, and not evidence for a different request. */
  private async assertProof(tx: Tx, fileId: string, requestId: string) {
    const f = await tx.storedFile.findUnique({ where: { id: fileId }, include: { uploadedBy: { select: { role: true } }, paymentProofs: { select: { requestId: true } } } });
    if (!f || f.purpose !== 'PAYMENT_PROOF') throw new AppError('VALIDATION_FAILED', 'Proof must be uploaded as a payment proof file.');
    if (!['ACCOUNTS', 'ADMIN'].includes(f.uploadedBy.role)) throw new AppError('VALIDATION_FAILED', 'Proof must be uploaded by Accounts.');
    if (f.scanStatus === 'INFECTED') throw new AppError('FILE_NOT_CLEAN', 'The proof file failed the malware scan.');
    if (f.paymentProofs.some((p) => p.requestId !== requestId)) throw new AppError('VALIDATION_FAILED', 'This proof file is already attached to another payout request.');
  }

  /** Applies an evaluation to the request and its card events inside the caller's transaction. */
  private async applyOutcome(tx: Tx, r: { id: string; publicRef: string; state: string }, paymentId: string, ev: Evaluation, paidAt: Date, entitlementIds: string[], actorUserId: string) {
    if (ev.payment === 'EXCEPTION') {
      await tx.externalPayment.update({ where: { id: paymentId }, data: { state: 'EXCEPTION', exceptionReason: ev.reason, exceptionRaisedAt: new Date(), exceptionRaisedByUserId: actorUserId } });
      if (r.state !== 'PAID') await tx.payoutRequest.update({ where: { id: r.id }, data: { state: 'ON_HOLD', holdReason: ev.reason, heldAt: new Date(), heldByUserId: actorUserId } });
      return r.state === 'PAID' ? 'PAID' : 'ON_HOLD';
    }
    if (ev.payment === 'PROOF_PENDING') {
      await tx.externalPayment.update({ where: { id: paymentId }, data: { state: 'PROOF_PENDING' } });
      await tx.payoutRequest.update({ where: { id: r.id }, data: { state: 'PAYMENT_RECORDED_PENDING_PROOF', holdReason: null, heldAt: null, heldByUserId: null } });
      return 'PAYMENT_RECORDED_PENDING_PROOF';
    }
    await tx.externalPayment.update({ where: { id: paymentId }, data: { state: 'VERIFIED' } });
    if (r.state === 'PAID') {
      await tx.payoutRequest.update({ where: { id: r.id }, data: { paidAt } });
      return 'PAID';
    }
    await tx.payoutRequest.update({ where: { id: r.id }, data: { state: 'PAID', paidAt, holdReason: null, heldAt: null, heldByUserId: null } });
    // Paid for this event (REQ-17 §17.7): only the entitlement ledger changes — never the MIS snapshot/history (INV-01).
    const moved = await tx.payoutEntitlement.updateMany({ where: { id: { in: entitlementIds }, state: 'RESERVED', currentRequestId: r.id }, data: { state: 'PAID' } });
    if (moved.count !== entitlementIds.length) throw new AppError('PAYOUT_STATE_INVALID', 'One or more card events are no longer reserved for this request; the payment cannot be finalised. Raise it with Admin.');
    await tx.payoutEntitlementEvent.createMany({ data: entitlementIds.map((e) => ({ entitlementId: e, fromState: 'RESERVED' as const, toState: 'PAID' as const, requestId: r.id, actorUserId, reason: `paid for this event via ${r.publicRef}` })) });
    await tx.outboxEvent.create({ data: { type: 'payouts.request.paid', payload: { requestId: r.id, paymentId, jobId: `payouts.request.paid:${r.id}:${paymentId}` } } });
    return 'PAID';
  }

  /** Maps partial-unique-index violations raised under concurrency to domain errors. */
  private mapUnique(e: unknown): never {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ExternalPayment_live_reference_idx')) throw new AppError('PAYOUT_DUPLICATE_TRANSFER_REFERENCE', 'This transfer reference is already recorded against another request.');
    if (msg.includes('ExternalPayment_one_live_per_request_idx') || msg.includes('ExternalPayment_one_pending_correction_idx')) throw new AppError('PAYOUT_STATE_INVALID', 'A payment record for this request already exists; use the correction workflow.');
    throw e;
  }

  private async notifyOutcome(r: { id: string; publicRef: string; advisorUserId: string; managerApproverUserId: string; totalAmountInr: unknown }, outcome: string, paidAt: Date, reference: string, reason?: string) {
    const amount = formatInr(Number(r.totalAmountInr));
    const link = { entityType: 'PayoutRequest', entityId: r.id };
    if (outcome === 'PAID') {
      const body = `${r.publicRef}: ${amount} paid on ${paidAt.toISOString().slice(0, 10)} (ref ${maskTransferReference(reference)}).`;
      await this.notifications.notify({ recipientUserId: r.advisorUserId, kind: 'PAYOUT_PAID', title: 'Payout paid', body, deepLink: link, dedupeKey: `payout:paid:${r.id}` });
      await this.notifications.notify({ recipientUserId: r.managerApproverUserId, kind: 'PAYOUT_PAID', title: 'Payout paid', body, deepLink: link, dedupeKey: `payout:paid:${r.id}:mgr` });
    } else if (outcome === 'ON_HOLD') {
      await this.notifications.notify({ recipientUserId: await this.hierarchy.adminUserId(), kind: 'PAYOUT_EXCEPTION', title: 'Payout payment exception', body: `${r.publicRef}: ${reason ?? 'payment held for review'}`, deepLink: link, dedupeKey: `payout:exception:${r.id}:${Date.now()}` });
    }
  }

  // ── record ──
  async record(actor: Actor, id: string, body: RecordPaymentBody) {
    if (actor.role !== 'ACCOUNTS') throw new AppError('RBAC_FORBIDDEN', 'Only Accounts records external payments.');
    const key = transferReferenceKey(body.transferReference);
    const paidAt = new Date(body.paidAt);
    let snapshot: { id: string; publicRef: string; advisorUserId: string; managerApproverUserId: string; totalAmountInr: unknown } | null = null;
    let outcome = '';
    let exceptionReason: string | undefined;
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const r = await this.lockRequest(tx, id);
        snapshot = r;
        if (r.payments.some((p) => (LIVE_PAYMENT_STATES as readonly string[]).includes(p.state))) throw new AppError('PAYOUT_STATE_INVALID', 'A payment is already recorded for this request. Multiple payments of one request are refused; use the audited correction workflow.');
        if (r.state !== 'APPROVED') throw new AppError('PAYOUT_STATE_INVALID', r.state === 'ON_HOLD' ? 'This request is on hold for Admin review; it cannot be paid until Admin releases it.' : `Only requests approved by both Manager and Admin can be paid (this one is ${r.state}).`);
        await this.assertReferenceFree(tx, key, id);
        if (body.proofFileId) await this.assertProof(tx, body.proofFileId, id);
        const p = await tx.externalPayment.create({ data: { requestId: id, recordedByUserId: actor.userId, paidAt, amountInr: body.amountInr, transferReference: body.transferReference, transferReferenceKey: key, method: body.method ?? null, proofFileId: body.proofFileId ?? null, proofAttachedAt: body.proofFileId ? new Date() : null, state: 'RECORDED' } });
        const ev = this.evaluate(body.amountInr, Number(r.totalAmountInr), Boolean(body.proofFileId));
        if (ev.payment === 'EXCEPTION') exceptionReason = ev.reason;
        outcome = await this.applyOutcome(tx, r, p.id, ev, paidAt, r.items.map((i) => i.entitlementId), actor.userId);
      });
    } catch (e) {
      this.mapUnique(e);
    }
    RequestContextStore.audit({ entityId: id, before: { state: 'APPROVED' }, after: { state: outcome, amountInr: body.amountInr, transferReferenceKey: key, method: body.method ?? null, proofFileId: body.proofFileId ?? null } });
    if (snapshot) await this.notifyOutcome(snapshot, outcome, paidAt, body.transferReference, exceptionReason);
    return this.requests.get(actor, id);
  }

  // ── attach proof to a PROOF_PENDING entry ──
  async attachProof(actor: Actor, id: string, body: AttachPaymentProofBody) {
    if (actor.role !== 'ACCOUNTS') throw new AppError('RBAC_FORBIDDEN', 'Only Accounts attaches payment proof.');
    let snapshot: Parameters<PaymentsService['notifyOutcome']>[0] | null = null;
    let live: { paidAt: Date; transferReference: string } | null = null;
    await this.prisma.client.$transaction(async (tx) => {
      const r = await this.lockRequest(tx, id);
      snapshot = r;
      const p = r.payments.find((x) => x.state === 'PROOF_PENDING');
      if (r.state !== 'PAYMENT_RECORDED_PENDING_PROOF' || !p) throw new AppError('PAYOUT_STATE_INVALID', 'This request is not waiting for payment proof.');
      live = p;
      await this.assertProof(tx, body.proofFileId, id);
      await tx.externalPayment.update({ where: { id: p.id }, data: { proofFileId: body.proofFileId, proofAttachedAt: new Date() } });
      await this.applyOutcome(tx, r, p.id, this.evaluate(Number(p.amountInr), Number(r.totalAmountInr), true), p.paidAt, r.items.map((i) => i.entitlementId), actor.userId);
    });
    RequestContextStore.audit({ entityId: id, before: { state: 'PAYMENT_RECORDED_PENDING_PROOF' }, after: { state: 'PAID', proofFileId: body.proofFileId } });
    if (snapshot && live) await this.notifyOutcome(snapshot, 'PAID', (live as { paidAt: Date }).paidAt, (live as { transferReference: string }).transferReference);
    return this.requests.get(actor, id);
  }

  // ── audited correction (Accounts proposes, Admin approves) ──
  async correct(actor: Actor, id: string, body: CorrectPaymentBody) {
    if (actor.role !== 'ACCOUNTS') throw new AppError('RBAC_FORBIDDEN', 'Only Accounts proposes payment corrections; Admin approves them.');
    const key = transferReferenceKey(body.transferReference);
    let created = '';
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const r = await this.lockRequest(tx, id);
        const live = r.payments.find((p) => (LIVE_PAYMENT_STATES as readonly string[]).includes(p.state));
        if (!live) throw new AppError('PAYOUT_STATE_INVALID', 'There is no payment record to correct.');
        if (r.payments.some((p) => p.state === 'CORRECTION_PENDING')) throw new AppError('PAYOUT_STATE_INVALID', 'A correction is already awaiting Admin approval.');
        const proofFileId = body.proofFileId ?? live.proofFileId ?? null;
        if (r.state === 'PAID' && (paise(body.amountInr) !== paise(Number(r.totalAmountInr)) || (!proofFileId && this.proofRequired())))
          throw new AppError('VALIDATION_FAILED', 'A paid request can only be corrected to the approved amount with proof. Flag reversals, partial or excess payments as an exception instead.');
        await this.assertReferenceFree(tx, key, id);
        if (body.proofFileId) await this.assertProof(tx, body.proofFileId, id);
        const p = await tx.externalPayment.create({ data: { requestId: id, recordedByUserId: actor.userId, paidAt: new Date(body.paidAt), amountInr: body.amountInr, transferReference: body.transferReference, transferReferenceKey: key, method: body.method ?? null, proofFileId, proofAttachedAt: proofFileId ? new Date() : null, state: 'CORRECTION_PENDING', correctionOfId: live.id, correctionReason: body.reason } });
        created = p.id;
      });
    } catch (e) {
      this.mapUnique(e);
    }
    RequestContextStore.audit({ entityId: id, after: { correctionPaymentId: created, amountInr: body.amountInr, transferReferenceKey: key }, reason: body.reason });
    const r = await this.prisma.client.payoutRequest.findUniqueOrThrow({ where: { id }, select: { publicRef: true } });
    await this.notifications.notify({ recipientUserId: await this.hierarchy.adminUserId(), kind: 'PAYOUT_EXCEPTION', title: 'Payment correction needs approval', body: `${r.publicRef}: ${body.reason}`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:correction:${created}` });
    return this.requests.get(actor, id);
  }

  async decideCorrection(actor: Actor, id: string, body: PaymentCorrectionDecisionBody) {
    if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Only Admin approves payment corrections.');
    let snapshot: Parameters<PaymentsService['notifyOutcome']>[0] | null = null;
    let outcome = '';
    let before = '';
    let pending: { id: string; paidAt: Date; transferReference: string; recordedByUserId: string } | null = null;
    let exceptionReason: string | undefined;
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const r = await this.lockRequest(tx, id);
        snapshot = r;
        before = r.state;
        const p = r.payments.find((x) => x.state === 'CORRECTION_PENDING');
        if (!p) throw new AppError('PAYOUT_STATE_INVALID', 'No correction is awaiting approval.');
        pending = p;
        if (p.recordedByUserId === actor.userId) throw new AppError('RBAC_FORBIDDEN', 'The person who proposed a correction cannot approve it.');
        const decided = { correctionDecidedAt: new Date(), correctionDecidedByUserId: actor.userId, correctionDecisionReason: body.reason };
        if (body.decision === 'REJECTED') {
          await tx.externalPayment.update({ where: { id: p.id }, data: { ...decided, state: 'CORRECTION_REJECTED' } });
          outcome = r.state;
          return;
        }
        // prior entry first, so the live-reference / live-per-request indexes never see two live rows
        if (p.correctionOfId) await tx.externalPayment.update({ where: { id: p.correctionOfId }, data: { state: 'SUPERSEDED', supersededAt: new Date() } });
        await tx.externalPayment.update({ where: { id: p.id }, data: { ...decided, state: 'RECORDED' } });
        const ev = this.evaluate(Number(p.amountInr), Number(r.totalAmountInr), Boolean(p.proofFileId));
        if (ev.payment === 'EXCEPTION') exceptionReason = ev.reason;
        if (r.state === 'PAID' && ev.payment !== 'VERIFIED') throw new AppError('VALIDATION_FAILED', 'A paid request can only be corrected to the approved amount with proof.');
        outcome = await this.applyOutcome(tx, r, p.id, ev, p.paidAt, r.items.map((i) => i.entitlementId), actor.userId);
      });
    } catch (e) {
      this.mapUnique(e);
    }
    RequestContextStore.audit({ entityId: id, before: { state: before }, after: { state: outcome, correction: body.decision, paymentId: (pending as { id: string } | null)?.id }, reason: body.reason });
    const pend = pending as { paidAt: Date; transferReference: string; recordedByUserId: string } | null;
    if (pend) {
      await this.notifications.notify({ recipientUserId: pend.recordedByUserId, kind: 'PAYOUT_EXCEPTION', title: `Payment correction ${body.decision === 'APPROVED' ? 'approved' : 'rejected'}`, body: `${(snapshot as { publicRef: string } | null)?.publicRef}: ${body.reason}`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:correction-decision:${(pending as { id: string } | null)?.id}` });
      if (snapshot && body.decision === 'APPROVED' && before !== 'PAID') await this.notifyOutcome(snapshot, outcome, pend.paidAt, pend.transferReference, exceptionReason);
    }
    return this.requests.get(actor, id);
  }

  // ── discrepancy / post-payment exception flag (REQ-18 §18.2, REQ-17 §17.7) ──
  async flag(actor: Actor, id: string, reason: string) {
    if (actor.role !== 'ACCOUNTS' && actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Only Accounts or Admin can flag a payment exception.');
    let result = '';
    const r0 = await this.prisma.client.$transaction(async (tx) => {
      const r = await this.lockRequest(tx, id);
      const live = r.payments.find((p) => (LIVE_PAYMENT_STATES as readonly string[]).includes(p.state));
      if (r.state === 'APPROVED' && !live) {
        await tx.payoutRequest.update({ where: { id }, data: { state: 'ON_HOLD', holdReason: reason, heldAt: new Date(), heldByUserId: actor.userId } });
        result = 'ON_HOLD';
      } else if (r.state === 'PAID' && live?.state === 'VERIFIED') {
        await tx.externalPayment.update({ where: { id: live.id }, data: { state: 'EXCEPTION', exceptionReason: reason, exceptionRaisedAt: new Date(), exceptionRaisedByUserId: actor.userId, resolvedAt: null, resolvedByUserId: null, resolutionNote: null } });
        result = 'PAID_EXCEPTION';
      } else throw new AppError('PAYOUT_STATE_INVALID', 'Only an approved unpaid request or a verified paid request can be flagged.');
      return r;
    });
    RequestContextStore.audit({ entityId: id, before: { state: r0.state }, after: { flagged: result }, reason });
    if (actor.role !== 'ADMIN') await this.notifications.notify({ recipientUserId: await this.hierarchy.adminUserId(), kind: 'PAYOUT_EXCEPTION', title: result === 'ON_HOLD' ? 'Accounts returned a payout for review' : 'Post-payment exception raised', body: `${r0.publicRef}: ${reason}`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:flag:${id}:${Date.now()}` });
    return this.requests.get(actor, id);
  }

  /** Admin: release a discrepancy hold back to Awaiting payment, or close a post-payment exception with a note. */
  async resolve(actor: Actor, id: string, reason: string) {
    if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Only Admin resolves payout exceptions.');
    let result = '';
    const r0 = await this.prisma.client.$transaction(async (tx) => {
      const r = await this.lockRequest(tx, id);
      const live = r.payments.find((p) => (LIVE_PAYMENT_STATES as readonly string[]).includes(p.state));
      if (r.state === 'ON_HOLD' && !live) {
        await tx.payoutRequest.update({ where: { id }, data: { state: 'APPROVED', holdReason: null, heldAt: null, heldByUserId: null } });
        result = 'APPROVED';
      } else if (r.state === 'PAID' && live?.state === 'EXCEPTION') {
        await tx.externalPayment.update({ where: { id: live.id }, data: { state: 'VERIFIED', resolvedAt: new Date(), resolvedByUserId: actor.userId, resolutionNote: reason } });
        result = 'PAID';
      } else if (live?.state === 'EXCEPTION') {
        throw new AppError('PAYOUT_STATE_INVALID', 'An unpaid request with a mismatched payment is resolved by an audited correction (Accounts proposes, Admin approves), not by accepting a different amount.');
      } else throw new AppError('PAYOUT_STATE_INVALID', 'Nothing to resolve on this request.');
      return r;
    });
    RequestContextStore.audit({ entityId: id, before: { state: r0.state }, after: { state: result }, reason });
    if (result === 'APPROVED') {
      for (const acct of await this.prisma.client.user.findMany({ where: { role: 'ACCOUNTS', status: 'ACTIVE' }, select: { id: true } })) {
        await this.notifications.notify({ recipientUserId: acct.id, kind: 'PAYOUT_READY_FOR_PAYMENT', title: 'Payout released for payment', body: `${r0.publicRef}: ${reason}`, deepLink: { entityType: 'PayoutRequest', entityId: id }, dedupeKey: `payout:released:${id}:${acct.id}:${Date.now()}` });
      }
    }
    return this.requests.get(actor, id);
  }

  // ── payee bank (masked by default; reveal is logged) ──
  async payee(actor: Actor, id: string, reveal: boolean) {
    if (actor.role !== 'ACCOUNTS' && actor.role !== 'ADMIN') throw AppError.notFound('Payout request');
    const r = await this.prisma.client.payoutRequest.findUnique({ where: { id }, select: { advisorUserId: true, state: true } });
    // Accounts only for dual-approved requests (REQ-18 §18.1: restrict payee banking fields to what payment needs)
    if (!r || (actor.role === 'ACCOUNTS' && !['APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'ON_HOLD'].includes(r.state))) throw AppError.notFound('Payout request');
    const p = await this.prisma.client.advisorProfile.findUnique({ where: { userId: r.advisorUserId } });
    if (!p) return { available: false, accountHolderName: null, bankName: null, ifsc: null, accountMasked: null, accountNumber: null, verified: false };
    let accountNumber: string | null = null;
    if (reveal) {
      if (!actor.permissions.includes('SENSITIVE_REVEAL_BANK')) throw new AppError('RBAC_FORBIDDEN', 'You cannot reveal bank details.');
      if (p.bankAccountEncrypted) accountNumber = this.crypto.decrypt(p.bankAccountEncrypted);
      await this.audit.sensitiveAccess({ entityType: 'AdvisorProfile', entityId: p.id, field: 'BANK_ACCOUNT', purpose: 'PAYOUT_PAYMENT' });
    }
    return { available: Boolean(p.bankAccountLast4), accountHolderName: p.accountHolderName, bankName: p.bankName, ifsc: p.ifsc, accountMasked: p.bankAccountLast4 ? `••••••${p.bankAccountLast4}` : null, accountNumber, verified: p.reviewOutcome === 'APPROVED' && p.onboardingStep === 'COMPLETE' };
  }

  // ── Accounts queue counts (same ledger as every other view — REQ-17 §17.9) ──
  async queues() {
    const sum = async (where: object) => {
      const a = await this.prisma.client.payoutRequest.aggregate({ where, _count: { _all: true }, _sum: { totalAmountInr: true } });
      return { count: a._count._all, amountInr: Number(a._sum.totalAmountInr ?? 0) };
    };
    const paidAmount = await this.prisma.client.externalPayment.aggregate({ where: { state: { in: ['VERIFIED', 'EXCEPTION'] }, request: { state: 'PAID' } }, _sum: { amountInr: true } });
    return {
      awaiting: await sum(PAYMENT_QUEUE_WHERE.awaiting),
      paid: { ...(await sum(PAYMENT_QUEUE_WHERE.paid)), confirmedTransferInr: Number(paidAmount._sum.amountInr ?? 0) },
      exceptions: await sum(PAYMENT_QUEUE_WHERE.exceptions),
      asOf: new Date().toISOString(),
    };
  }
}
