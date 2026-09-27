import { z } from 'zod';

// ── F-303 customer list import ──
export const CreateCustomerBatchBody = z.object({ fileId: z.string().uuid(), sheetName: z.string().max(100).optional() });
export type CreateCustomerBatchBody = z.infer<typeof CreateCustomerBatchBody>;

export const CustomerHeaderMapping = z.object({
  name: z.string().min(1),
  mobile: z.string().min(1),
  pincode: z.string().min(1),
  pan: z.string().min(1).nullable().optional(),
});
export type CustomerHeaderMapping = z.infer<typeof CustomerHeaderMapping>;

export const ConfirmCustomerBatchBody = z.object({
  consentRepresentationConfirmed: z.boolean().optional(),
  sourceVendor: z.string().trim().max(200).optional(),
  permittedUseBasis: z.string().trim().max(500).optional(),
});
export type ConfirmCustomerBatchBody = z.infer<typeof ConfirmCustomerBatchBody>;

export const ReviewRecordBody = z.object({ action: z.enum(['ACCEPT', 'EXCLUDE']), reason: z.string().min(3).max(500) });
export type ReviewRecordBody = z.infer<typeof ReviewRecordBody>;

export const RowIssue = {
  INVALID_MOBILE: 'INVALID_MOBILE',
  INVALID_PINCODE: 'INVALID_PINCODE',
  BLANK_NAME: 'BLANK_NAME',
  INVALID_PAN: 'INVALID_PAN',
  DUPLICATE_IN_BATCH: 'DUPLICATE_IN_BATCH',
  DUPLICATE_OF_EXISTING: 'DUPLICATE_OF_EXISTING',
  SUPPRESSED: 'SUPPRESSED',
} as const;
export type RowIssue = (typeof RowIssue)[keyof typeof RowIssue];

// ── F-305 manual reassignment ──
export const ReassignRecordBody = z.object({ toTelecallerUserId: z.string().uuid(), reason: z.string().min(3).max(500) });
export type ReassignRecordBody = z.infer<typeof ReassignRecordBody>;

// ── F-808 one current status per calling record (mutually exclusive; the counts sum to the total) ──
export const RECORD_STATUSES = ['NEEDS_REVIEW', 'EXCLUDED', 'DO_NOT_CONTACT', 'UNASSIGNED', 'UNTOUCHED', 'UNREACHABLE', 'FOLLOW_UP', 'INTERESTED', 'LINK_SHARED', 'DECLINED', 'COMPLETED'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];
/** Plain labels. None is a bank result: a calling record never knows whether a card was issued (INV-05). */
export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  NEEDS_REVIEW: 'Needs import review',
  EXCLUDED: 'Excluded at import',
  DO_NOT_CONTACT: 'Do not contact',
  UNASSIGNED: 'Waiting for a caller',
  UNTOUCHED: 'Not yet called',
  UNREACHABLE: 'Not reachable',
  FOLLOW_UP: 'Follow-up scheduled',
  INTERESTED: 'Interested',
  LINK_SHARED: 'Link / PDF shared',
  DECLINED: 'Declined',
  COMPLETED: 'Completed',
};
/** Precedence: import review → do-not-contact → unassigned → the assigned record's interaction status. */
export function recordStatusOf(r: { reviewStatus: string; suppressed: boolean; assignedTelecallerUserId: string | null; interactionStatus: string }): RecordStatus {
  if (r.reviewStatus === 'EXCLUDED') return 'EXCLUDED';
  if (r.reviewStatus === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
  if (r.suppressed) return 'DO_NOT_CONTACT';
  if (!r.assignedTelecallerUserId) return 'UNASSIGNED';
  return r.interactionStatus as RecordStatus;
}

// ── F-307 calling queue ──
export const QueueTab = z.enum(['active', 'followups', 'hidden']);
export type QueueTab = z.infer<typeof QueueTab>;
export const QueueQuery = z.object({
  tab: QueueTab.default('active'),
  /** F-808: explicit record status or `ALL`; overrides `tab` (Admin/Manager records list). */
  status: z.enum([...RECORD_STATUSES, 'ALL']).optional(),
  /** F-808: pincode prefix. */
  pincode: z.string().regex(/^\d{1,6}$/, 'Digits only').optional(),
  search: z.string().trim().max(100).optional(),
  telecallerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type QueueQuery = z.infer<typeof QueueQuery>;

/** Row of the calling queue (mobile + web). Mobile is always masked in lists (REQ-08 §8.3). */
export interface CallingQueueRow {
  id: string;
  fullName: string;
  mobileMasked: string;
  pincode: string;
  location: string;
  locationResolved: boolean;
  assignedTelecaller: { id: string; fullName: string } | null;
  assignedAt: string | null;
  interactionStatus: string;
  nextFollowUpAt: string | null;
  lastOutcome: { outcome: string; at: string; remarks: string | null } | null;
  suppressed: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  canCall: boolean;
  batchRef: string;
  batchId: string;
  /** F-808 derived current status. */
  recordStatus: RecordStatus;
}

/** F-808 `GET /calling/records/summary`: every figure over the actor's scope, as of `asOf`. */
export interface CallingRecordsSummary {
  total: number;
  byStatus: Record<RecordStatus, number>;
  /** distinct records with at least one call attempt / a provider-connected attempt */
  attempted: number;
  connected: number;
  followUpsDue: number;
  batches: { total: number; needingAction: number };
  asOf: string;
}
