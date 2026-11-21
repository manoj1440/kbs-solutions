import { COMPANY, LEGAL_PATHS, legalFact } from '@kbs/shared';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Bullets, Fact, LegalHeader, LegalSection, linkClass } from '../_components/legal-ui';

export const metadata: Metadata = { title: 'Terms of use', robots: { index: false, follow: false } };

/** F-908: short terms of use for the platform. DRAFT wording; the owner approves it with the privacy notice. */
const TERMS_VERSION = 'v1-draft';
const TERMS_UPDATED = '21 Nov 2026';

export default function TermsPage() {
  const operator = legalFact(COMPANY.legalName);
  return (
    <div className="grid gap-8">
      <LegalHeader
        title="Terms of use"
        intro="The rules for using the KBS Solutions app and website. By signing in, you agree to them."
        meta={`Version ${TERMS_VERSION}, updated ${TERMS_UPDATED}`}
      />
      <p role="note" className="max-w-[68ch] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-ui leading-relaxed text-amber-700">
        This is a draft. KBS has not yet approved the final wording.
      </p>
      <article className="grid min-w-0 max-w-3xl gap-10 rounded-2xl border border-border bg-card px-5 py-7 sm:px-8 sm:py-9">
        <LegalSection id="who" heading="Who runs the platform">
          <p>
            KBS Solutions is run by <Fact value={operator} />. In these terms, &ldquo;KBS&rdquo; means that business.
          </p>
        </LegalSection>
        <LegalSection id="access" heading="Who may use it">
          <p>Only people KBS has authorised may sign in: KBS staff, and Advisors whose sign-up KBS has approved. You must be 18 or older.</p>
          <p>Your account is for you alone. Do not share your sign-in code or let anyone else use your account. Tell KBS at once if you think someone else has used it.</p>
        </LegalSection>
        <LegalSection id="acceptable-use" heading="Acceptable use">
          <p>When you use the platform, you must not:</p>
          <Bullets
            items={[
              'Enter details of a customer who has not agreed to apply, or enter false details.',
              'Promise a customer that a card is guaranteed or approved. Only the bank decides.',
              'Ask a customer for an OTP, a payment or a fee.',
              'Call anyone who has asked not to be called, or outside the permitted hours.',
              'Copy, export, photograph or share customer data outside the platform.',
              'Try to get into parts of the platform or data you are not allowed to see, or disrupt the service.',
            ]}
          />
        </LegalSection>
        <LegalSection id="confidentiality" heading="Customer data is confidential">
          <p>
            Customer names, mobile numbers, PAN, income and application details are confidential. Use them only to process the application the customer asked for. The{' '}
            <Link href={LEGAL_PATHS.privacy} className={linkClass}>
              privacy notice
            </Link>{' '}
            explains how KBS handles personal data.
          </p>
          <p>Every action in the platform is logged, including who viewed sensitive details.</p>
        </LegalSection>
        <LegalSection id="suspension" heading="Suspension and closing accounts">
          <p>KBS may suspend or close an account that breaks these terms, puts customers at risk, or is no longer needed, for example when someone leaves. KBS may also sign you out of all devices to protect an account.</p>
        </LegalSection>
        <LegalSection id="payouts" heading="Payouts">
          <p>Advisor payouts are governed by your agreement with KBS and the payout rules shown in the app. Bank status in the app comes from the banks&rsquo; reports. A payout becomes due only as those rules say.</p>
        </LegalSection>
        <LegalSection id="changes" heading="Changes to these terms">
          <p>KBS may update these terms. The version and date at the top change when they do, and continuing to use the platform means you accept the new terms.</p>
        </LegalSection>
        <LegalSection id="law" heading="Governing law">
          <p>These terms are governed by the laws of India.</p>
        </LegalSection>
        <LegalSection id="contact" heading="Questions and complaints">
          <p>
            See{' '}
            <Link href={LEGAL_PATHS.grievance} className={linkClass}>
              Grievances
            </Link>{' '}
            for how to reach the Grievance Officer.
          </p>
        </LegalSection>
      </article>
    </div>
  );
}
