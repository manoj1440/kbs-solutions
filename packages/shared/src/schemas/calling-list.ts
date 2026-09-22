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
