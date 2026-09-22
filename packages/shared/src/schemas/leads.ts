import { z } from 'zod';

/** F-406 lead draft steps (server-side drafts; each PATCH idempotent). */
export const LEAD_STEPS = ['MOBILE', 'DETAILS', 'PAN', 'PINCODE', 'EMPLOYMENT', 'INCOME', 'DECLARATIONS', 'REVIEW'] as const;
export type LeadStep = (typeof LEAD_STEPS)[number];

export const CreateLeadDraftBody = z.object({ cardId: z.string().uuid() }).strict();
export type CreateLeadDraftBody = z.infer<typeof CreateLeadDraftBody>;

export const LeadMobileBody = z.object({ mobile: z.string().min(10).max(16), duplicateOverrideReason: z.string().trim().min(3).max(300).optional() }).strict();
export const LeadDetailsBody = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200).optional(), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict();
export const LeadPanBody = z.object({ pan: z.string().trim().min(10).max(10) }).strict();
export const LeadPincodeBody = z.object({ pincode: z.string().regex(/^\d{6}$/), city: z.string().trim().max(80).optional(), state: z.string().trim().max(80).optional(), locationConfirmed: z.boolean() }).strict();
export const EmploymentTypeValue = z.enum(['SALARIED', 'SELF_EMPLOYED', 'SELF_EMPLOYED_PROFESSIONAL']);
export const LeadEmploymentBody = z.object({ employmentType: EmploymentTypeValue }).strict();
export const LeadIncomeBody = z.object({ annualIncomeItr: z.coerce.number().min(0).max(1_000_000_000) }).strict();
export const LeadDeclarationsBody = z.object({ acceptedDeclarationIds: z.array(z.string().min(1)).min(1), bureauAcknowledged: z.literal(true) }).strict();
export type LeadMobileBody = z.infer<typeof LeadMobileBody>;
export type LeadDetailsBody = z.infer<typeof LeadDetailsBody>;
export type LeadPanBody = z.infer<typeof LeadPanBody>;
export type LeadPincodeBody = z.infer<typeof LeadPincodeBody>;
export type LeadEmploymentBody = z.infer<typeof LeadEmploymentBody>;
export type LeadIncomeBody = z.infer<typeof LeadIncomeBody>;
export type LeadDeclarationsBody = z.infer<typeof LeadDeclarationsBody>;

export interface DeclarationText {
  id: string;
  version: string;
  text: string;
}

export interface LeadDraftView {
  id: string;
  step: LeadStep;
  card: { id: string; name: string; bank: { id: string; displayName: string } };
  data: {
    mobileMasked?: string;
    fullName?: string;
    email?: string;
    dob?: string;
    panMasked?: string;
    panVerification?: { status: string; providerRef: string | null };
    pincode?: string;
    city?: string;
    state?: string;
    locationConfirmed?: boolean;
    employmentType?: string;
    annualIncomeItr?: number;
    acceptedDeclarationIds?: string[];
    bureauAckAt?: string;
    duplicateWarning?: { leadPublicRef: string; createdAt: string } | null;
  };
  declarations: DeclarationText[];
  expiresAt: string;
  updatedAt: string;
}

// ── F-407 ──
export const BankReferenceBody = z.object({ referenceKind: z.enum(['APPLICATION_NO', 'APPLICATION_REFERENCE_NUMBER', 'OTHER']), referenceValue: z.string().min(1).max(120) }).strict();
export type BankReferenceBody = z.infer<typeof BankReferenceBody>;

export const LeadListQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50), q: z.string().trim().max(80).optional(), advisorId: z.string().uuid().optional() });
export type LeadListQuery = z.infer<typeof LeadListQuery>;
