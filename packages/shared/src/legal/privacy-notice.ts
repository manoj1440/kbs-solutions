/**
 * The privacy notice, as data, so the web page (`/privacy`) and the app screen render the same text.
 * Workstream C owns the wording. Keep sentences plain; no legal fact is written here directly —
 * `buildPrivacyNotice` reads `COMPANY` (company.ts) through `legalFact`, so a null shows the fallback.
 *
 * DRAFT: the owner must approve this wording before launch. When it changes, bump `version` here and
 * `onboarding.privacyNoticeVersion` in the admin configuration together (the release check fails on 'draft').
 */
import { COMPANY, type CompanyFacts, LEGAL_PATHS, legalFact } from './company';

export interface NoticeSection {
  id: string;
  heading: string;
  paragraphs: string[];
  items?: string[];
}

export interface PrivacyNotice {
  /** Must equal the `onboarding.privacyNoticeVersion` config value an Advisor consents to. */
  version: string;
  /** ISO date of the last change. */
  updated: string;
  sections: NoticeSection[];
}

export const PRIVACY_NOTICE_VERSION = 'v1-draft';
export const PRIVACY_NOTICE_UPDATED = '2026-11-21';

/**
 * Hosting the repository documents for the current (staging) deployment. Shown as "currently" next to
 * `COMPANY.dataStorageRegion`; update together with the real production hosting.
 */
export const CURRENT_HOSTING: readonly string[] = [
  'Database and stored files: Supabase, Seoul, South Korea (ap-northeast-2).',
  'Application server and job queue: Render, Singapore.',
  'Web pages: Vercel, Singapore (sin1).',
];

/** Service providers (processors) that handle personal data on KBS's behalf, as currently configured. */
export const CURRENT_PROCESSORS: readonly string[] = [
  'Supabase: database and file storage.',
  'Render: runs the application server and its job queue.',
  'Vercel: serves the web pages.',
  'Expo and Google Firebase Cloud Messaging: deliver push notifications to phones.',
  'Cashfree: identity check through DigiLocker and PAN verification.',
  'Exotel: places and records business calls.',
  'MSG91: sends sign-in codes by SMS, once it is switched on.',
];

/** Builds the notice from the company facts. Every unknown fact renders as `LEGAL_FALLBACK`. */
export function buildPrivacyNotice(company: CompanyFacts = COMPANY): PrivacyNotice {
  const name = legalFact(company.legalName);
  const officer = company.grievanceOfficer;
  return {
    version: PRIVACY_NOTICE_VERSION,
    updated: PRIVACY_NOTICE_UPDATED,
    sections: [
      {
        id: 'who-we-are',
        heading: 'Who we are',
        paragraphs: [
          `KBS Solutions is a platform for selling credit cards through Advisors and a calling team. It is run by ${name} (the "Data Fiduciary" under the Digital Personal Data Protection Act, 2023).`,
          'This notice explains what personal data we collect, why, who we share it with, how long we keep it, and the rights you have.',
        ],
        items: [
          `Legal name: ${name}`,
          `Type of entity: ${legalFact(company.entityType)}`,
          `Registration number: ${legalFact(company.registrationNumber)}`,
          `Registered address: ${legalFact(company.registeredAddress)}`,
          `Privacy contact: ${legalFact(company.privacyEmail)}`,
        ],
      },
      {
        id: 'what-we-collect',
        heading: 'What we collect',
        paragraphs: ['What we collect depends on how you use KBS Solutions.'],
        items: [
          'Advisors and field sales staff: mobile number, name, PAN, the result of your identity check through DigiLocker (we never store your Aadhaar number), bank account details and a cancelled cheque, any photo or document you upload, and your phone\'s push notification token.',
          'KBS staff (Telecallers, Managers, Accounts and Admin): mobile number, name, employee code, call activity and call recordings.',
          'Customers and prospects: name, mobile number, PAN, income and the other details entered on the lead form, rows in calling lists we work through, and bank report (MIS) rows about your card application.',
          'Everyone who signs in: sign-in records, IP address, device details and an audit trail of the actions taken in the system.',
        ],
      },
      {
        id: 'why',
        heading: 'Why we use it',
        paragraphs: ['We use personal data only for these purposes:'],
        items: [
          'To sign you in and keep your account secure.',
          'To check the identity and bank details of Advisors before they are activated and paid.',
          'To submit credit-card applications to the bank a customer chose, and to track their status.',
          'To call prospects from approved calling lists and record the outcome.',
          'To calculate and pay Advisor payouts, and keep the payment records the law requires.',
          'To train staff and check the quality of calls.',
          'To send you notices and reminders about your work in the app.',
          'To detect misuse, investigate incidents and meet legal duties.',
        ],
      },
      {
        id: 'legal-basis',
        heading: 'Our legal basis',
        paragraphs: [
          'Advisors: we rely on the consent you give when you sign up. You can withdraw it at any time. Withdrawing stops new processing, but records we must keep by law stay.',
          'KBS staff: we process your data for employment purposes and the other legitimate uses the law allows.',
          'Customers: the Advisor asks for your consent through a declaration on the lead form before your details are entered. We then use your details to process the card application you asked for.',
          'Prospects on calling lists: we only call lists that KBS compliance has approved, and we stop calling anyone who asks us to.',
        ],
      },
      {
        id: 'sharing',
        heading: 'Who we share it with',
        paragraphs: [
          'We share a customer\'s application details with the bank they apply to. We do not sell personal data.',
          'These service providers currently process data for us, under our instructions:',
        ],
        items: [...CURRENT_PROCESSORS],
      },
      {
        id: 'storage',
        heading: 'Where your data is stored',
        paragraphs: [`Production storage region: ${legalFact(company.dataStorageRegion)}.`, 'The service is currently hosted here, outside India:'],
        items: [...CURRENT_HOSTING],
      },
      {
        id: 'retention',
        heading: 'How long we keep it',
        paragraphs: [
          `How long we keep each kind of data: ${legalFact(null)}.`,
          'Until these periods are set, we do not delete records automatically. The exception is short-lived technical records, such as expired sign-in codes and unfinished lead drafts, which we delete after they expire.',
          'Payout, payment and tax records are kept for as long as the law requires.',
        ],
      },
      {
        id: 'your-rights',
        heading: 'Your rights',
        paragraphs: ['You have the right to:'],
        items: [
          'Get a summary of the personal data we hold about you and how we use it.',
          'Ask us to correct or complete it.',
          'Ask us to erase it, where we are not required to keep it by law.',
          'Raise a grievance with us.',
          'Nominate someone to use these rights for you if you die or cannot act.',
        ],
      },
      {
        id: 'how-to-use-rights',
        heading: 'How to use your rights',
        paragraphs: ['You can send a request in any of these ways:'],
        items: [
          'In the app: open Profile, then "Your data".',
          'On the web: sign in and open your account page.',
          `Or contact the Grievance Officer (details below, and at ${LEGAL_PATHS.grievance}).`,
        ],
      },
      {
        id: 'grievance-officer',
        heading: 'Grievance Officer',
        paragraphs: ['If you have a question or a complaint about your personal data, contact:'],
        items: [
          `Name: ${legalFact(officer.name)}`,
          `Designation: ${legalFact(officer.designation)}`,
          `Email: ${legalFact(officer.email)}`,
          `Phone: ${legalFact(officer.phone)}`,
          `Hours: ${legalFact(officer.hours)}`,
        ],
      },
      {
        id: 'board',
        heading: 'Data Protection Board of India',
        paragraphs: [
          'Please raise your complaint with us first. If you are not satisfied with our answer, you can complain to the Data Protection Board of India.',
        ],
      },
      {
        id: 'children',
        heading: 'Children',
        paragraphs: [
          'KBS Solutions is for adults aged 18 and over. We refuse Advisor sign-ups when the identity check shows the person is under 18.',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookies',
        paragraphs: ['The website uses only the cookies it needs to work. We do not use analytics or advertising trackers.'],
        items: [
          'kbs_access: keeps you signed in.',
          'kbs_refresh: renews your sign-in without asking for a new code.',
          'kbs_theme: remembers light or dark mode.',
          'kbs_nav: remembers whether the side menu is open.',
        ],
      },
      {
        id: 'security',
        heading: 'How we protect it',
        paragraphs: [
          'PAN and bank account numbers are encrypted when stored, and shown masked unless a person needs the full value. Data is encrypted in transit.',
          'Access depends on your role. Every change, and every time someone views sensitive data, is logged.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to this notice',
        paragraphs: [
          `This is version ${PRIVACY_NOTICE_VERSION}, last updated on ${PRIVACY_NOTICE_UPDATED}. When we change it, we update the version and date, and ask Advisors to read it again in the app.`,
        ],
      },
    ],
  };
}

export const PRIVACY_NOTICE: PrivacyNotice = buildPrivacyNotice();
