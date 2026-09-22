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
  /** Only requests awaiting the actor's own approval. */
  awaitingMe: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
});
export type PayoutRequestListQuery = z.infer<typeof PayoutRequestListQuery>;

/** Ledger "position" vocabulary (REQ-17 §17.8) — derived from entitlement + request state, never from bank status. */
export const LEDGER_POSITIONS = ['Pending hold', 'Available for claim', 'Request submitted', 'Manager approval pending', 'Admin approval pending', 'Both approved / Accounts payment pending', 'Payment recorded / proof pending', 'Paid', 'Under review', 'On hold', 'Void'] as const;
export type LedgerPosition = (typeof LEDGER_POSITIONS)[number];
