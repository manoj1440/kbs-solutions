import { z } from 'zod';

/**
 * F-409 — Pending Actions and operational follow-up tasks (REQ-11 §11.10).
 * Tasks come only from (a) explicit follow-ups and (b) Admin-configured MIS rules with a verified route.
 * Nothing is derived from blank cells or a generic "Inprocess".
 */

export const PENDING_CTAS = ['ENTER_BANK_REFERENCE', 'SHARE_APPLICATION_LINK', 'CONTACT_CUSTOMER', 'OPEN_LEAD'] as const;
export type PendingCta = (typeof PENDING_CTAS)[number];

export const CreateFollowUpTaskBody = z
  .object({
    text: z.string().trim().min(3).max(500),
    dueAt: z.string().datetime(),
    /** Manager may assign to an advisor in their team; defaults to the actor. */
    ownerUserId: z.string().uuid().optional(),
  })
  .strict();
export type CreateFollowUpTaskBody = z.infer<typeof CreateFollowUpTaskBody>;

export const PendingActionsQuery = z.object({
  includeDone: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  leadId: z.string().uuid().optional(),
});
export type PendingActionsQuery = z.infer<typeof PendingActionsQuery>;

/** One configured rule under `mis.actionableRules` (validated on read; invalid entries are ignored and logged). */
export const MisActionableRule = z
  .object({
    bankCode: z.string().min(1),
    /** Internal snapshot field, e.g. `curableFlag`, `vkycStatus`, `dropoffReason`. */
    field: z.string().min(1),
    /** Case-insensitive regular expression tested against the exact bank text. */
    pattern: z.string().min(1),
    label: z.string().min(3).max(200),
    /** Who acts. Omit when the bank text is informational only — it is then shown verbatim without a CTA. */
    owner: z.enum(['ADVISOR', 'MANAGER']).optional(),
    cta: z.enum(PENDING_CTAS).optional(),
  })
  .strict();
export type MisActionableRule = z.infer<typeof MisActionableRule>;

export interface PendingAction {
  id: string;
  leadId: string;
  leadRef: string;
  customer: string;
  card: string;
  issuer: string;
  owner: { userId: string | null; name: string | null; role: 'ADVISOR' | 'MANAGER' | 'BANK' | null };
  whatToDo: string;
  source: { type: 'KBS_TASK'; createdByUserId: string } | { type: 'MIS_FIELD'; field: string; batchRef: string | null; bankText: string };
  date: string;
  cta: PendingCta | null;
  doneAt: string | null;
}
