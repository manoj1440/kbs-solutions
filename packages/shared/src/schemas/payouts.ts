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
