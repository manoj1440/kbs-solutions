import { z } from 'zod';

/**
 * F-904 data retention (REQ-21 §21.5, REQ-24 §24.4, INV-07). Durations are OPEN: every category is driven by a
 * `retention.*Days` config key and nothing runs until KBS sets it and turns on `retention.executionEnabled`.
 * Files are purged (object removed, row kept as the trace); calling records are restricted (PII redacted), never
 * deleted. MIS rows/history, payout ledger and audit logs are out of scope for retention by construction.
 */
export const RETENTION_CATEGORIES = ['RECORDINGS', 'DOCUMENTS', 'MIS_FILES', 'CALLING_RECORDS'] as const;
export type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];

export const RETENTION_CATEGORY_META: Record<RetentionCategory, { label: string; configKey: string; action: 'PURGE_FILE' | 'RESTRICT_RECORD'; purposes?: readonly string[] }> = {
  RECORDINGS: { label: 'Call recordings', configKey: 'retention.recordingsDays', action: 'PURGE_FILE', purposes: ['RECORDING'] },
  DOCUMENTS: { label: 'Cheques, payment proofs, ID cards', configKey: 'retention.documentsDays', action: 'PURGE_FILE', purposes: ['CHEQUE', 'PAYMENT_PROOF', 'ID_CARD'] },
  MIS_FILES: { label: 'MIS source files', configKey: 'retention.misFilesDays', action: 'PURGE_FILE', purposes: ['MIS'] },
  CALLING_RECORDS: { label: 'Calling records', configKey: 'retention.callingRecordsDays', action: 'RESTRICT_RECORD' },
};

export const RetentionExecuteBody = z.object({
  category: z.enum(RETENTION_CATEGORIES),
  reason: z.string().trim().min(10, 'Give the policy or approval reference (at least 10 characters).').max(500),
  /** Upper bound per run so one click never touches an unbounded set. */
  limit: z.coerce.number().int().min(1).max(5000).default(500),
});
export type RetentionExecuteBody = z.infer<typeof RetentionExecuteBody>;

export const LEGAL_HOLD_SUBJECTS = ['FILE', 'CALLING_RECORD'] as const;
export const LegalHoldBody = z.object({
  subject: z.enum(LEGAL_HOLD_SUBJECTS),
  id: z.string().uuid(),
  hold: z.boolean(),
  reason: z.string().trim().min(5).max(500),
});
export type LegalHoldBody = z.infer<typeof LegalHoldBody>;

export const LegalHoldListQuery = z.object({ subject: z.enum(LEGAL_HOLD_SUBJECTS).optional() });
