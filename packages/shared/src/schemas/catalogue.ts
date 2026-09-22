import { z } from 'zod';

// ── F-403 banks & cards ──
export const CreateBankBody = z.object({ code: z.string().trim().min(2).max(20).regex(/^[A-Z0-9_]+$/, 'UPPERCASE code'), displayName: z.string().trim().min(2).max(100) });
export type CreateBankBody = z.infer<typeof CreateBankBody>;
export const UpdateBankBody = z.object({ displayName: z.string().trim().min(2).max(100).optional(), active: z.boolean().optional() });
export type UpdateBankBody = z.infer<typeof UpdateBankBody>;

export const Money = z.coerce.number().min(0).max(1_000_000);
export const CardBody = z.object({
  bankId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  productCode: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  benefits: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  joiningFee: Money.nullable().optional(),
  annualFee: Money.nullable().optional(),
  majorCharges: z.array(z.object({ label: z.string().trim().min(1).max(100), value: z.string().trim().min(1).max(200) })).max(30).optional(),
  eligibilityHighlights: z.string().trim().max(2000).nullable().optional(),
  disclosures: z.string().trim().max(4000).nullable().optional(),
  imageFileId: z.string().uuid().nullable().optional(),
  benefitPdfFileId: z.string().uuid().nullable().optional(),
  categoryKeys: z.array(z.string().min(1)).max(10).optional(),
});
export type CardBody = z.infer<typeof CardBody>;
export const UpdateCardBody = CardBody.partial().omit({ bankId: true });
export type UpdateCardBody = z.infer<typeof UpdateCardBody>;

export const PublishCardBody = z.object({ overrideReason: z.string().trim().min(3).max(500).optional() });
export type PublishCardBody = z.infer<typeof PublishCardBody>;

export const ChannelValue = z.enum(['TELECALLER', 'ADVISOR', 'BOTH']);
export const CreateLinkBody = z.object({
  channel: ChannelValue,
  /** Stored verbatim — never trimmed beyond outer whitespace, never normalised (REQ-07 §7.5, WA-02). */
  url: z.string().min(8).max(2000).refine((u) => /^https?:\/\//i.test(u), 'Must start with http(s)://'),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
});
export type CreateLinkBody = z.infer<typeof CreateLinkBody>;

export const CreateCrosswalkBody = z.object({ bankId: z.string().uuid(), misProductCode: z.string().trim().min(1).max(120), cardId: z.string().uuid() });
export type CreateCrosswalkBody = z.infer<typeof CreateCrosswalkBody>;

// ── F-404 bank pincode profiles ──
export const SourceabilityRule = z.discriminatedUnion('rule', [
  z.object({ rule: z.literal('PRESENT_PINCODE_IS_SOURCEABLE'), preserve: z.array(z.string()).optional(), note: z.string().optional(), ignoreEmptyAutoHeaders: z.boolean().optional() }),
  z.object({ rule: z.literal('FLAG_EQUALS'), column: z.string().min(1), trueValues: z.array(z.string().min(1)).min(1), preserve: z.array(z.string()).optional(), note: z.string().optional(), ignoreEmptyAutoHeaders: z.boolean().optional() }),
  z.object({ rule: z.literal('REQUIRES_BANK_MAPPING'), preserve: z.array(z.string()).optional(), note: z.string().optional(), ignoreEmptyAutoHeaders: z.boolean().optional() }),
]);
export type SourceabilityRule = z.infer<typeof SourceabilityRule>;

export const UpdatePincodeProfileBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  sheetName: z.string().trim().max(100).nullable().optional(),
  headers: z.array(z.string().min(1)).min(1).optional(),
  pincodeColumn: z.string().min(1).optional(),
  semantics: SourceabilityRule.optional(),
  padNumericPincodes: z.boolean().optional(),
});
export type UpdatePincodeProfileBody = z.infer<typeof UpdatePincodeProfileBody>;

export const CreatePincodeBatchBody = z.object({ fileId: z.string().uuid(), sheetName: z.string().max(100).optional() });
export type CreatePincodeBatchBody = z.infer<typeof CreatePincodeBatchBody>;
