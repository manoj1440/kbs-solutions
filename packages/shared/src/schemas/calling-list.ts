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

// ── F-307 calling queue ──
export const QueueTab = z.enum(['active', 'followups', 'hidden']);
export type QueueTab = z.infer<typeof QueueTab>;
export const QueueQuery = z.object({
  tab: QueueTab.default('active'),
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
}
