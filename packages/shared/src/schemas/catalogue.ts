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

// ── F-308 publications & availability ──
export const CreatePublicationBody = z
  .object({
    channel: ChannelValue,
    scope: z.enum(['GLOBAL', 'STATE', 'PINCODE']),
    pincode: z.string().regex(/^\d{6}$/).optional(),
    state: z.string().trim().min(2).max(60).optional(),
    effectiveTo: z.string().datetime().nullable().optional(),
  })
  .refine((b) => (b.scope === 'PINCODE' ? Boolean(b.pincode) : b.scope === 'STATE' ? Boolean(b.state) : true), { message: 'pincode/state required for that scope' });
export type CreatePublicationBody = z.infer<typeof CreatePublicationBody>;

export const AvailableCardsQuery = z.object({ pincode: z.string().regex(/^\d{6}$/), channel: z.enum(['TELECALLER', 'ADVISOR']) });
export type AvailableCardsQuery = z.infer<typeof AvailableCardsQuery>;

/** Exact empty-state wording mandated by REQ-07 §7.4 — never "ineligible". */
export const NO_CARD_AVAILABLE_MESSAGE = 'No card available for this pincode from current uploaded data';

export interface AvailableCard {
  id: string;
  name: string;
  version: number;
  bank: { id: string; code: string; displayName: string };
  categories: { key: string; label: string }[];
  description: string | null;
  benefits: string[];
  joiningFee: number | null;
  annualFee: number | null;
  majorCharges: { label: string; value: string }[];
  eligibilityHighlights: string | null;
  disclosures: string | null;
  imageFileId: string | null;
  benefitPdfFileId: string | null;
  link: { id: string; version: number; channel: string } | null;
  provenance: { sourceability: string; batchId: string; rawFlags: Record<string, string>; batchUploadedAt: string | null; publication: { scope: 'GLOBAL' | 'STATE' | 'PINCODE'; id: string } };
}

// ── F-405 Advisor browse ──
export const BrowseCardsQuery = z.object({
  category: z.string().min(1).optional(),
  bankId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  sort: z.enum(['bank', 'name', 'joiningFee', 'annualFee']).default('bank'),
});
export type BrowseCardsQuery = z.infer<typeof BrowseCardsQuery>;

/** Catalogue card as browsed by an Advisor (S08–S12). */
export interface BrowseCard extends Omit<AvailableCard, 'provenance' | 'link'> {
  link: { id: string; version: number; channel: string } | null;
  /** Only when `pincode` was supplied: true/false from the bank's uploaded data, 'unknown' when the bank has no approved import. */
  sourceableAtPincode: boolean | 'unknown' | null;
  sourceabilityProvenance: { sourceability: 'SOURCEABLE' | 'NOT_SOURCEABLE' | 'REQUIRES_BANK_MAPPING'; batchUploadedAt: string | null } | null;
}
