/**
 * Legal facts about KBS shown in the privacy notice, terms and grievance pages (DPDP Act 2023 s.8(9)-(10)).
 *
 * Only the owner can supply these. Every unknown is `null` on purpose: never fill one with a guess.
 * UI must show `LEGAL_FALLBACK` for a null value, and `scripts/release-check.mjs` lists each null as a
 * production blocker. Fill a value here (one place) and every surface — web, app, API — picks it up.
 */
export interface GrievanceOfficer {
  name: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  /** e.g. "Mon–Fri, 10:00–18:00 IST" */
  hours: string | null;
}

export interface CompanyFacts {
  /** Registered legal name of the entity that runs KBS Solutions (the Data Fiduciary). */
  legalName: string | null;
  /** Company / LLP / proprietorship / partnership. */
  entityType: string | null;
  /** CIN or LLPIN, when applicable. */
  registrationNumber: string | null;
  gstin: string | null;
  registeredAddress: string | null;
  /** Public contact for privacy questions; may be the Grievance Officer's email. */
  privacyEmail: string | null;
  grievanceOfficer: GrievanceOfficer;
  /** Where production personal data is stored (e.g. "India (Mumbai)"). Must match the real hosting. */
  dataStorageRegion: string | null;
}

export const COMPANY: CompanyFacts = {
  legalName: null,
  entityType: null,
  registrationNumber: null,
  gstin: null,
  registeredAddress: null,
  privacyEmail: null,
  grievanceOfficer: { name: null, designation: null, email: null, phone: null, hours: null },
  dataStorageRegion: null,
};

/** Shown wherever a legal fact is still `null`. */
export const LEGAL_FALLBACK = 'To be confirmed by KBS';

export function legalFact(value: string | null | undefined): string {
  return value && value.trim() ? value : LEGAL_FALLBACK;
}

/** Dotted paths of every unfilled fact — used by the release check and an admin warning. */
export function missingCompanyFacts(c: CompanyFacts = COMPANY): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(c)) {
    if (k === 'grievanceOfficer') continue;
    if (v === null || (typeof v === 'string' && !v.trim())) out.push(k);
  }
  for (const [k, v] of Object.entries(c.grievanceOfficer)) {
    if (v === null || (typeof v === 'string' && !v.trim())) out.push(`grievanceOfficer.${k}`);
  }
  return out;
}

/** Public web paths of the legal pages (apps/web `(legal)` group). */
export const LEGAL_PATHS = {
  privacy: '/privacy',
  terms: '/terms',
  grievance: '/grievance',
} as const;
