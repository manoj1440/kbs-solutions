import { COMPANY, LEGAL_PATHS, legalFact } from '@kbs/shared';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Bullets, FactList, LegalHeader, LegalSection, linkClass } from '../_components/legal-ui';

export const metadata: Metadata = { title: 'Grievances', robots: { index: false, follow: false } };

/**
 * F-908 (DPDP Act 2023 s.8(10), s.13): Grievance Officer, how to complain, how to use data rights and how to delete an
 * account (Google Play needs a public web page for account deletion). No response times are promised here: KBS answers
 * within the period the DPDP Rules require.
 */
export default function GrievancePage() {
  const o = COMPANY.grievanceOfficer;
  return (
    <div className="grid gap-8">
      <LegalHeader title="Grievances" intro="How to raise a complaint about your personal data, use your data rights, or delete your account." />
      <article className="grid min-w-0 max-w-3xl gap-10 rounded-2xl border border-border bg-card px-5 py-7 sm:px-8 sm:py-9">
        <LegalSection id="officer" heading="Grievance Officer">
          <p>Contact the Grievance Officer with any question or complaint about how KBS Solutions handles your personal data.</p>
          <FactList
            facts={[
              ['Name', legalFact(o.name)],
              ['Designation', legalFact(o.designation)],
              ['Email', legalFact(o.email)],
              ['Phone', legalFact(o.phone)],
              ['Hours', legalFact(o.hours)],
              ['Postal address', legalFact(COMPANY.registeredAddress)],
            ]}
          />
        </LegalSection>

        <LegalSection id="complain" heading="How to raise a complaint">
          <p>Write to the Grievance Officer, or send a grievance request from the app or the web account page. Please include:</p>
          <Bullets
            items={[
              'Your name and the mobile number you use with KBS Solutions.',
              'What happened and when.',
              'What you would like us to do.',
            ]}
          />
          <p>We will reply within the period the Digital Personal Data Protection Rules require. We may ask you to confirm your identity before we share or change any data.</p>
        </LegalSection>

        <LegalSection id="rights" heading="Access, correction and erasure">
          <p>You can ask for a summary of your data, ask us to correct it, or ask us to erase it where the law does not require us to keep it.</p>
          <Bullets
            items={[
              'In the app: open Profile, then "Your data".',
              'On the web (KBS staff with web access): sign in, open your account page, then "Your data".',
              'Or write to the Grievance Officer.',
            ]}
          />
          <p>Payout, payment and tax records are kept for as long as the law requires, even after an erasure request.</p>
        </LegalSection>

        <LegalSection id="delete-account" heading="Delete your account">
          <p>To ask KBS to delete your account and the personal data linked to it:</p>
          <ol className="grid list-decimal gap-1.5 pl-5 marker:text-fg-2">
            <li>Sign in to the KBS Solutions app (or the website, if you have web access).</li>
            <li>Open Profile (on the web, your account page), then &ldquo;Your data&rdquo;.</li>
            <li>Choose a deletion (erasure) request and send it.</li>
          </ol>
          <p>If you cannot sign in, write to the Grievance Officer from the email address or mobile number known to KBS, and say you want your account deleted.</p>
          <p>KBS staff handle each request by hand. Records the law requires us to keep, such as payouts and the audit trail, are kept and then deleted when that period ends.</p>
        </LegalSection>

        <LegalSection id="board" heading="If you are not satisfied">
          <p>If our answer does not resolve your complaint, you can complain to the Data Protection Board of India.</p>
          <p>
            Read the full{' '}
            <Link href={LEGAL_PATHS.privacy} className={linkClass}>
              privacy notice
            </Link>{' '}
            for what we collect and why.
          </p>
        </LegalSection>
      </article>
    </div>
  );
}
