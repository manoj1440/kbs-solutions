import { z } from 'zod';

import { IFSC_REGEX } from '../normalize';

/**
 * F-401 Advisor onboarding step bodies. INV: no field named like `aadhaar*` may exist here except a status label;
 * the API never accepts an Aadhaar number, XML, share code or image (REQ-10 §10.2). `.strict()` rejects unknown keys.
 */
export const OnboardingPersonalBody = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200) }).strict();
export type OnboardingPersonalBody = z.infer<typeof OnboardingPersonalBody>;

export const OnboardingConsentBody = z.object({ privacyNoticeVersion: z.string().min(1).max(40), identityConsent: z.literal(true), termsAccepted: z.literal(true) }).strict();
export type OnboardingConsentBody = z.infer<typeof OnboardingConsentBody>;

/** Provider payload is opaque to KBS; the schema forbids the obvious PII carriers by name. */
export const OnboardingIdentityCompleteBody = z
  .object({ sessionRef: z.string().min(1).max(200), payload: z.unknown() })
  .strict()
  .superRefine((v, ctx) => {
    const p = v.payload;
    if (p && typeof p === 'object') {
      for (const k of Object.keys(p as object)) if (/aadha?ar|uid|share.?code|xml/i.test(k)) ctx.addIssue({ code: 'custom', message: `Field "${k}" is not accepted; identity data stays with the verification provider.` });
    }
    if (typeof p === 'string' && /^\d{12}$/.test(p.replace(/\s/g, ''))) ctx.addIssue({ code: 'custom', message: 'A 12-digit identity number is never accepted.' });
  });
export type OnboardingIdentityCompleteBody = z.infer<typeof OnboardingIdentityCompleteBody>;

export const OnboardingBankBody = z
  .object({
    accountHolderName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, '9–18 digits'),
    ifsc: z.string().trim().toUpperCase().regex(IFSC_REGEX, 'Invalid IFSC'),
    bankName: z.string().trim().min(2).max(100),
  })
  .strict();
export type OnboardingBankBody = z.infer<typeof OnboardingBankBody>;

export const OnboardingChequeBody = z.object({ fileId: z.string().uuid() }).strict();
export type OnboardingChequeBody = z.infer<typeof OnboardingChequeBody>;

export const OnboardingAgentCodeBody = z.object({ code: z.string().trim().min(4).max(12).optional() }).strict();
export type OnboardingAgentCodeBody = z.infer<typeof OnboardingAgentCodeBody>;

export const OnboardingReviewBody = z.object({ decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().min(3).max(500).optional() }).strict().refine((b) => b.decision === 'APPROVE' || Boolean(b.reason), { message: 'A reason is required to reject.' });
export type OnboardingReviewBody = z.infer<typeof OnboardingReviewBody>;

export const ONBOARDING_STEPS = ['PERSONAL', 'CONSENT', 'IDENTITY', 'BANK', 'CHEQUE', 'AGENT_CODE', 'REVIEW', 'AWAITING_REVIEW', 'COMPLETE'] as const;
export type OnboardingStepName = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingView {
  step: OnboardingStepName;
  stepIndex: number;
  totalSteps: number;
  personal: { fullName: string; email: string | null };
  consent: { privacyNoticeVersion: string; at: string } | null;
  identity: { status: string; provider: string | null; method: string | null; verifiedAt: string | null; summary: Record<string, unknown> | null; sessionRef?: string; instructions?: string };
  bank: { accountHolderName: string; accountLast4: string; ifsc: string; bankName: string } | null;
  cheque: { fileId: string; originalName: string } | null;
  reportingParent: { id: string; fullName: string; role: string } | null;
  submittedAt: string | null;
  review: { outcome: string; reason: string | null; at: string } | null;
  requiresAdminReview: boolean;
  privacyNoticeVersion: string;
}
