import { z } from 'zod';

/** Internal snapshot fields a profile may map (mirror of BankStatusSnapshot text columns + date columns). */
export const MIS_TEXT_FIELDS = ['applicationNo', 'applicationReferenceNumber', 'currentStage', 'finalDecision', 'cardActivationStatus', 'ipaStatus', 'kycStatus', 'vkycStatus', 'bkycStatus', 'kycSuccessNr', 'dropoffReason', 'declineCode', 'declineDescription', 'declineDescription2', 'declineType', 'reason', 'curableFlag', 'dapFinalFlag', 'idcomStatus', 'productCode', 'productDescription', 'cardType', 'securedUnsecured', 'customerType', 'channel', 'promoCode', 'lc2Code', 'decisionMonth', 'customerName', 'companyName', 'captureLink'] as const;
export const MIS_DATE_FIELDS = ['creationDateTime', 'creationDate', 'finalDecisionDate', 'vkycConsentDate', 'vkycExpiryDate'] as const;
export type MisTextField = (typeof MIS_TEXT_FIELDS)[number];
export type MisDateField = (typeof MIS_DATE_FIELDS)[number];
/** Fields that never leave the server unmasked in previews (REQ-13 §13.4 step 3). */
export const MIS_PII_FIELDS: readonly string[] = ['customerName', 'companyName', 'captureLink'];
/** Fields that are shown to Advisors as the three status badges (INV-02). */
export const MIS_STATUS_FIELDS = ['currentStage', 'finalDecision', 'cardActivationStatus'] as const;

export const MisReferenceKind = z.enum(['APPLICATION_NO', 'APPLICATION_REFERENCE_NUMBER', 'OTHER']);
export const MisReferenceField = z.object({ kind: MisReferenceKind, header: z.string().min(1) });

export const UpdateMisProfileBody = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    sheetSelector: z.string().trim().max(100).nullable().optional(),
    headerAliases: z.record(z.string(), z.array(z.string().min(1))).optional(),
    fieldMap: z.record(z.string(), z.string().min(1)).optional(),
    referenceFields: z.array(MisReferenceField).min(1).optional(),
    snapshotMode: z.enum(['DELTA', 'FULL_SNAPSHOT']).optional(),
    blankOverwrites: z.boolean().optional(),
    timezone: z.string().min(1).max(60).optional(),
    timezoneAssumed: z.boolean().optional(),
    dateFormats: z.array(z.string().min(1)).optional(),
    knownValues: z.record(z.string(), z.array(z.string())).optional(),
  })
  .strict();
export type UpdateMisProfileBody = z.infer<typeof UpdateMisProfileBody>;

export const CreateMisBatchBody = z.object({ bankId: z.string().uuid(), profileId: z.string().uuid(), fileId: z.string().uuid(), sheetName: z.string().max(100).optional() }).strict();
export type CreateMisBatchBody = z.infer<typeof CreateMisBatchBody>;

export const MisBatchListQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50), bankId: z.string().uuid().optional(), stage: z.string().optional() });
export type MisBatchListQuery = z.infer<typeof MisBatchListQuery>;

export const MisRowsQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(50), matchState: z.enum(['PENDING', 'MATCHED', 'UNMATCHED', 'CONFLICT', 'INVALID', 'DUPLICATE_IN_BATCH', 'IGNORED']).optional(), reveal: z.coerce.boolean().optional() });
export type MisRowsQuery = z.infer<typeof MisRowsQuery>;

export const MisResolveBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('LINK_TO_LEAD'), leadId: z.string().uuid(), referenceKind: MisReferenceKind, reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal('IGNORE'), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal('PREFER_ROW'), rowId: z.string().uuid(), reason: z.string().trim().min(3).max(500) }),
]);
export type MisResolveBody = z.infer<typeof MisResolveBody>;
