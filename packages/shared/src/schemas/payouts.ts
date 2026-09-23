import { z } from 'zod';

import { MIS_PII_FIELDS, MIS_TEXT_FIELDS } from './mis';

/**
 * F-601 — payout rules and rates (REQ-17 §17.1, §17.9; ADR-008).
 * Trigger values are exact bank strings; `V + ACTIVE` and `TXN ACTIVE - Rs 100` are never merged (REQ-14 §14.4).
 */
export const PAYOUT_TRIGGER_FIELDS = MIS_TEXT_FIELDS.filter((f) => !MIS_PII_FIELDS.includes(f)) as readonly string[];
const TriggerField = z.string().refine((f) => PAYOUT_TRIGGER_FIELDS.includes(f), 'triggerField must be a non-PII MIS snapshot field');
const isoDate = z.string().datetime();

export const CreatePayoutRuleBody = z
  .object({
    bankId: z.string().uuid(),
    name: z.string().trim().min(3).max(80),
    triggerField: TriggerField.default('cardActivationStatus'),
    /** Exact strings as the bank writes them; compared after trim only. */
    triggerValues: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
    /** Optional regex tested against the snapshot productCode (case-insensitive). */
    productCodePattern: z.string().trim().min(1).max(120).optional(),
    holdDays: z.number().int().min(0).max(365).default(0),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
export type CreatePayoutRuleBody = z.infer<typeof CreatePayoutRuleBody>;

/** Editing an APPROVED rule creates a new DRAFT version; editing a DRAFT edits in place. */
export const UpdatePayoutRuleBody = CreatePayoutRuleBody.omit({ bankId: true }).partial().strict();
export type UpdatePayoutRuleBody = z.infer<typeof UpdatePayoutRuleBody>;

export const CreatePayoutRateBody = z
  .object({
    amountInr: z.number().positive().max(10_000_000),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.optional(),
  })
  .strict();
export type CreatePayoutRateBody = z.infer<typeof CreatePayoutRateBody>;

export const PayoutRuleListQuery = z.object({ bankId: z.string().uuid().optional(), status: z.enum(['DRAFT', 'APPROVED', 'RETIRED']).optional() });
export type PayoutRuleListQuery = z.infer<typeof PayoutRuleListQuery>;

export interface PayoutRateView {
  id: string;
  amountInr: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  approvedAt: string | null;
  approvedBy: { id: string; fullName: string } | null;
}
export interface PayoutRuleView {
  id: string;
  bank: { id: string; code: string; displayName: string };
  name: string;
  version: number;
  status: string;
  triggerField: string;
  triggerValues: string[];
  productCodePattern: string | null;
  holdDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedAt: string | null;
  approvedBy: { id: string; fullName: string } | null;
  notes: string | null;
  createdAt: string;
  rates: PayoutRateView[];
  /** Rate in force right now (APPROVED, effective), if any. */
  currentRate: PayoutRateView | null;
  entitlementCount: number;
}

// ── F-603 / F-604 requests and approvals ──
export const CreatePayoutRequestBody = z
  .object({ entitlementIds: z.array(z.string().uuid()).min(1).max(500).optional(), all: z.boolean().optional() })
  .strict()
  .refine((b) => b.all === true || (b.entitlementIds?.length ?? 0) > 0, 'Select entitlements or pass all: true');
export type CreatePayoutRequestBody = z.infer<typeof CreatePayoutRequestBody>;

export const PayoutApprovalBody = z
  .object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().max(500).optional() })
  .strict()
  .refine((b) => b.decision === 'APPROVED' || (b.reason?.length ?? 0) >= 3, 'A rejection needs a reason');
export type PayoutApprovalBody = z.infer<typeof PayoutApprovalBody>;

export const PayoutRequestListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  state: z.enum(['PENDING_APPROVALS', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'ON_HOLD']).optional(),
  advisorId: z.string().uuid().optional(),
  /** F-605 Accounts queues: awaiting = APPROVED; paid = PAID; exceptions = ON_HOLD, proof pending, payment exception or correction awaiting Admin. */
  queue: z.enum(['awaiting', 'paid', 'exceptions']).optional(),
  /** Only requests awaiting the actor's own approval. */
  awaitingMe: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
});
export type PayoutRequestListQuery = z.infer<typeof PayoutRequestListQuery>;

/** Ledger "position" vocabulary (REQ-17 §17.8) — derived from entitlement + request state, never from bank status. */
export const LEDGER_POSITIONS = ['Pending hold', 'Available for claim', 'Request submitted', 'Manager approval pending', 'Admin approval pending', 'Both approved / Accounts payment pending', 'Payment recorded / proof pending', 'Paid', 'Under review', 'On hold', 'Void'] as const;
export type LedgerPosition = (typeof LEDGER_POSITIONS)[number];

// ── F-605 Accounts external payment (REQ-17 §17.6–§17.7, REQ-18) ──
/** Payment rails Accounts may name; KBS never executes any of them. */
export const PAYMENT_METHODS = ['NEFT', 'IMPS', 'RTGS', 'UPI', 'CHEQUE', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Duplicate detection key for a bank transfer reference: upper-cased with all whitespace removed. */
export function transferReferenceKey(ref: string): string {
  return ref.replace(/\s+/g, '').toUpperCase();
}

/** Privacy-safe form for the Advisor receipt (REQ-18 §18.2). */
export function maskTransferReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const k = ref.replace(/\s+/g, '');
  return k.length <= 4 ? '••••' : `${'•'.repeat(Math.min(8, k.length - 4))}${k.slice(-4)}`;
}

const TransferReference = z
  .string()
  .trim()
  .min(4, 'Transfer reference is too short')
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 /_.-]*$/, 'Use the bank reference exactly as issued (letters, digits, / _ . -)');

const PaymentFields = z.object({
  /** When the transfer was executed outside KBS. Not in the future (5-minute clock skew allowed). */
  paidAt: z
    .string()
    .datetime()
    .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60_000, 'Payment date cannot be in the future'),
  amountInr: z.number().positive().max(100_000_000).multipleOf(0.01),
  transferReference: TransferReference,
  method: z.enum(PAYMENT_METHODS).optional(),
  proofFileId: z.string().uuid().optional(),
});

export const RecordPaymentBody = PaymentFields.strict();
export type RecordPaymentBody = z.infer<typeof RecordPaymentBody>;

export const AttachPaymentProofBody = z.object({ proofFileId: z.string().uuid() }).strict();
export type AttachPaymentProofBody = z.infer<typeof AttachPaymentProofBody>;

/** Audited correction: a replacement entry; the prior one is retained (REQ-18 §18.3). Admin approval required. */
export const CorrectPaymentBody = PaymentFields.extend({ reason: z.string().trim().min(5).max(500) }).strict();
export type CorrectPaymentBody = z.infer<typeof CorrectPaymentBody>;

export const PaymentCorrectionDecisionBody = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().min(3).max(500) }).strict();
export type PaymentCorrectionDecisionBody = z.infer<typeof PaymentCorrectionDecisionBody>;

/** Accounts/Admin: flag an amount/bank discrepancy (before payment) or a post-payment issue (reversal, partial, overpayment). */
export const PaymentFlagBody = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
export type PaymentFlagBody = z.infer<typeof PaymentFlagBody>;

export const PaymentExceptionResolveBody = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
export type PaymentExceptionResolveBody = z.infer<typeof PaymentExceptionResolveBody>;

/** Payment record as Admin / Manager / Accounts see it (full trace). */
export interface ExternalPaymentView {
  id: string;
  state: string;
  paidAt: string;
  amountInr: number;
  transferReference: string;
  method: string | null;
  proofFileId: string | null;
  proofAttachedAt: string | null;
  recordedBy: { id: string; fullName: string };
  recordedAt: string;
  exceptionReason: string | null;
  exceptionRaisedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  correctionOfId: string | null;
  correctionReason: string | null;
  correctionDecision: { by: { id: string; fullName: string } | null; at: string; reason: string | null } | null;
  supersededAt: string | null;
}

/** What the Advisor sees: confirmation + privacy-safe receipt (no proof file, no operator). */
export interface PaymentReceiptView {
  state: string;
  paidAt: string;
  amountInr: number;
  transferReferenceMasked: string | null;
  method: string | null;
}

// ── F-606 payout reconciliation dashboard + exceptions ──
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const PAYOUT_DATE_BASES = ['eligibleAt', 'submittedAt', 'paidAt'] as const;
export const PayoutDashboardQuery = z.object({
  from: day.optional(),
  to: day.optional(),
  /** Which date the range filters on; always echoed in `meta.dateBasis` (REQ-16 §16.3). */
  dateBasis: z.enum(PAYOUT_DATE_BASES).default('eligibleAt'),
  bankId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  advisorId: z.string().uuid().optional(),
});
export type PayoutDashboardQuery = z.infer<typeof PayoutDashboardQuery>;

/** Derived payout exception kinds. Only the acknowledgeable ones can be resolved here; payment ones use the F-605 flows. */
export const PAYOUT_EXCEPTION_KINDS = ['PAYMENT_EXCEPTION', 'DISCREPANCY_HOLD', 'MISSING_PROOF', 'CORRECTION_PENDING', 'STALE_REQUEST', 'MIS_CORRECTION_AFTER_PAYMENT', 'UNDER_REVIEW_IN_REQUEST'] as const;
export type PayoutExceptionKind = (typeof PAYOUT_EXCEPTION_KINDS)[number];
export const ACKNOWLEDGEABLE_PAYOUT_EXCEPTIONS = ['STALE_REQUEST', 'MIS_CORRECTION_AFTER_PAYMENT'] as const;

export const ResolvePayoutExceptionBody = z
  .object({ kind: z.enum(ACKNOWLEDGEABLE_PAYOUT_EXCEPTIONS), subjectId: z.string().uuid(), reason: z.string().trim().min(5).max(500) })
  .strict();
export type ResolvePayoutExceptionBody = z.infer<typeof ResolvePayoutExceptionBody>;
