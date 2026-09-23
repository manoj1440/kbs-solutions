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

// ── F-311 sharing ──
export const ShareBody = z.object({
  targetType: z.enum(['CALLING_RECORD', 'LEAD']),
  targetId: z.string().uuid(),
  kind: z.enum(['BENEFIT_PDF', 'OFFICE_ID', 'APPLICATION_LINK']),
  cardId: z.string().uuid().optional(),
});
export type ShareBody = z.infer<typeof ShareBody>;

export interface ShareResult {
  shareActionId: string;
  kind: ShareBody['kind'];
  channel: 'WHATSAPP_HANDOFF' | 'WHATSAPP_BUSINESS_API';
  handoffResult: 'OPENED' | 'FAILED';
  /** Strictly from the provider; HANDOFF is always UNKNOWN (WA-01). */
  deliveryStatus: 'UNKNOWN' | 'SENT' | 'DELIVERED' | 'FAILED';
  handoffUrl: string | null;
  providerMessageId: string | null;
  /** What the customer receives (link verbatim; PDF/ID via KBS redirect). */
  message: string;
  consentPolicyConfigured: boolean;
  callingInterestId: string | null;
  linkVersion: number | null;
}

export function shareStatusLabel(r: Pick<ShareResult, 'channel' | 'handoffResult' | 'deliveryStatus'>): string {
  if (r.deliveryStatus === 'DELIVERED') return 'Delivered';
  if (r.deliveryStatus === 'SENT') return 'Sent';
  if (r.deliveryStatus === 'FAILED') return 'Delivery failed';
  return r.handoffResult === 'OPENED' ? 'Share sheet opened' : 'Could not open share sheet';
}

// ── F-314 org-wide telephony / WhatsApp / recording oversight ──
/** A call still REQUESTED/RINGING/CONNECTED after this long has no terminal provider event (same window that blocks re-dial). */
export const CALL_LIVE_WINDOW_MINUTES = 30;
/** A connected call whose recording is still pending this long after it ended is overdue. Display threshold, not business policy. */
export const RECORDING_OVERDUE_MINUTES = 60;

export const OVERSIGHT_ATTENTION = ['NO_PROVIDER_CONFIRMATION', 'FAILED_BEFORE_PROVIDER', 'RECORDING_FAILED', 'RECORDING_OVERDUE', 'SHARE_FAILED'] as const;
export type OversightAttention = (typeof OVERSIGHT_ATTENTION)[number];
export const OVERSIGHT_ATTENTION_LABELS: Record<OversightAttention, string> = {
  NO_PROVIDER_CONFIRMATION: 'No provider confirmation',
  FAILED_BEFORE_PROVIDER: 'Failed before provider',
  RECORDING_FAILED: 'Recording failed',
  RECORDING_OVERDUE: 'Recording overdue',
  SHARE_FAILED: 'Share failed',
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const OversightBase = z.object({
  /** IST calendar days (inclusive). Default: the last 7 days. */
  from: day.optional(),
  to: day.optional(),
  managerId: z.string().uuid().optional(),
});
export const OversightSummaryQuery = OversightBase.extend({ telecallerId: z.string().uuid().optional() });
export type OversightSummaryQuery = z.infer<typeof OversightSummaryQuery>;
const pageFields = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
export const OversightCallsQuery = OversightBase.extend({
  ...pageFields,
  telecallerId: z.string().uuid().optional(),
  state: CallProviderStateValue.optional(),
  recording: z.enum(['AVAILABLE', 'PENDING', 'FAILED', 'NONE']).optional(),
  attention: z.enum(['NO_PROVIDER_CONFIRMATION', 'FAILED_BEFORE_PROVIDER', 'RECORDING_FAILED', 'RECORDING_OVERDUE']).optional(),
});
export type OversightCallsQuery = z.infer<typeof OversightCallsQuery>;
export const OversightSharesQuery = OversightBase.extend({
  ...pageFields,
  actorId: z.string().uuid().optional(),
  kind: z.enum(['BENEFIT_PDF', 'OFFICE_ID', 'APPLICATION_LINK']).optional(),
  channel: z.enum(['WHATSAPP_HANDOFF', 'WHATSAPP_BUSINESS_API']).optional(),
  handoff: z.enum(['OPENED', 'FAILED']).optional(),
  delivery: z.enum(['UNKNOWN', 'SENT', 'DELIVERED', 'FAILED']).optional(),
  attention: z.literal('SHARE_FAILED').optional(),
});
export type OversightSharesQuery = z.infer<typeof OversightSharesQuery>;

/** Hand-off ≠ delivery (WA-01): a hand-off share never reads as delivered. */
export function shareDeliveryLabel(channel: ShareResult['channel'], handoff: ShareResult['handoffResult'], delivery: ShareResult['deliveryStatus']): string {
  if (handoff === 'FAILED') return 'Could not open share';
  if (delivery === 'DELIVERED') return 'Delivered (provider)';
  if (delivery === 'SENT') return 'Sent (provider)';
  if (delivery === 'FAILED') return 'Delivery failed (provider)';
  return channel === 'WHATSAPP_HANDOFF' ? 'Hand-off only — delivery not reported' : 'Awaiting provider status';
}

/** Attention flags for one call — pure so the list, the summary and the tests agree. */
export function callAttention(
  c: { providerState: CallProviderStateValue; providerCallId: string | null; initiatedAt: Date; connectedAt: Date | null; endedAt: Date | null; recordingStatus: RecordingStatusValue | null },
  now: Date,
): OversightAttention[] {
  const out: OversightAttention[] = [];
  const live = c.providerState === 'REQUESTED' || c.providerState === 'RINGING' || c.providerState === 'CONNECTED';
  if (live && now.getTime() - c.initiatedAt.getTime() > CALL_LIVE_WINDOW_MINUTES * 60_000) out.push('NO_PROVIDER_CONFIRMATION');
  if (c.providerState === 'FAILED' && !c.providerCallId) out.push('FAILED_BEFORE_PROVIDER');
  if (c.recordingStatus === 'FAILED') out.push('RECORDING_FAILED');
  const waiting = c.recordingStatus === 'PENDING' || c.recordingStatus === null || c.recordingStatus === 'NOT_ATTEMPTED';
  if (c.connectedAt && c.endedAt && waiting && now.getTime() - c.endedAt.getTime() > RECORDING_OVERDUE_MINUTES * 60_000) out.push('RECORDING_OVERDUE');
  return out;
}
