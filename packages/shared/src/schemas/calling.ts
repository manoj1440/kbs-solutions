import { z } from 'zod';

import { CallOutcome } from '../enums';

// ── F-309 calls ──
export const InitiateCallBody = z.object({ callingRecordId: z.string().uuid() });
export type InitiateCallBody = z.infer<typeof InitiateCallBody>;

export const CallProviderStateValue = z.enum(['REQUESTED', 'RINGING', 'CONNECTED', 'ENDED', 'FAILED', 'NO_ANSWER', 'UNKNOWN']);
export type CallProviderStateValue = z.infer<typeof CallProviderStateValue>;
export const RecordingStatusValue = z.enum(['NOT_ATTEMPTED', 'PENDING', 'AVAILABLE', 'FAILED']);
export type RecordingStatusValue = z.infer<typeof RecordingStatusValue>;

/** Chip label derived strictly from the recording row (CALL-02): never "Recorded" unless AVAILABLE. */
export function recordingChip(status: RecordingStatusValue | null | undefined): 'Recording available' | 'Recording unavailable' | 'Recording pending' | 'Not attempted' {
  if (status === 'AVAILABLE') return 'Recording available';
  if (status === 'FAILED') return 'Recording unavailable';
  if (status === 'PENDING') return 'Recording pending';
  return 'Not attempted';
}

export interface CallAttemptView {
  id: string;
  callingRecordId: string;
  providerKey: string;
  providerCallId: string | null;
  targetMobileMasked: string;
  initiatedAt: string;
  providerState: CallProviderStateValue;
  connectedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  failureReason: string | null;
  recording: { status: RecordingStatusValue; durationSec: number | null; failureReason: string | null } | null;
  /** Client may retry after this instant when the provider failed (REQ-08 §8.2 safe retry). */
  retryAfter: string | null;
  disclosureText: string | null;
}

// ── F-310 outcomes / remarks ──
export const RecordOutcomeBody = z.object({
  callAttemptId: z.string().uuid().optional(),
  outcome: z.enum(Object.values(CallOutcome) as [CallOutcome, ...CallOutcome[]]),
  remarks: z.string().trim().max(1000).optional(),
  followUpAt: z.string().datetime().optional(),
  selectedCardId: z.string().uuid().optional(),
  doNotContact: z.boolean().optional(),
});
export type RecordOutcomeBody = z.infer<typeof RecordOutcomeBody>;

export const RemarkBody = z.object({ text: z.string().trim().min(1).max(2000) });
export type RemarkBody = z.infer<typeof RemarkBody>;

/** Operational labels the Telecaller sees; kinds are fixed and none maps to a bank stage (INV-05). */
export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  NO_ANSWER_OR_FAILED: 'No answer / unreachable / technical failure',
  CONNECTED_INTERESTED: 'Connected — interested',
  CONNECTED_LINK_OR_PDF_SHARED: 'Connected — link / PDF shared',
  FOLLOW_UP: 'Callback / follow-up',
  DECLINED: 'Declined',
  COMPLETED_NO_FURTHER: 'Completed — no further action',
};
