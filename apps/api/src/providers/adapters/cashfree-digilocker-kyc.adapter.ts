import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import type { KycProvider } from '../ports';

import {
  cashfreeCode,
  cashfreeReferenceId,
  cashfreeRequest,
  type CashfreeResult,
  type CashfreeVerificationConfig,
  describeFailure,
} from './cashfree-verification.client';
import { namesMatch } from './name-match';

export interface CashfreeDigilockerConfig extends CashfreeVerificationConfig {
  /** Externally reachable API base (`API_PUBLIC_URL`); Cashfree only accepts an https redirect URL. */
  apiPublicUrl: string;
  /** Test seam for the age calculation. */
  now?: () => Date;
}

export const DIGILOCKER_RETURN_PATH = '/api/v1/onboarding/identity/return';
/** Shown by DigiLocker on its consent screen (letters, digits, spaces and underscores only, max 50). */
export const DIGILOCKER_COMPANY_NAME = 'KBS Solutions';
const INSTRUCTIONS =
  "Open DigiLocker, sign in and allow KBS Solutions to verify your Aadhaar. Then come back and tap 'I have completed verification'.";

type AgeBand = 'ADULT' | 'MINOR' | null;
type KycResult = Awaited<ReturnType<KycProvider['complete']>>;
/** Why a verification did not succeed. Codes only — never a name, a date or a number. */
export type DigilockerFailureReason =
  | 'PROFILE_NAME_MISSING'
  | 'LINK_EXPIRED'
  | 'CONSENT_DENIED'
  | 'CONSENT_SESSION_EXPIRED'
  | 'DOCUMENT_CONSENT_NOT_GIVEN'
  | 'DOCUMENT_NOT_LINKED'
  | 'PROVIDER_DETAIL_MISMATCH'
  | 'SESSION_NOT_FOUND'
  | 'NAME_NOT_READABLE'
  | 'NAME_MISMATCH'
  | 'AGE_UNKNOWN'
  | 'MINOR';

const unavailableToStart = () =>
  new AppError(
    'RATE_LIMITED',
    'The identity verification service is unavailable right now. Please try again later.',
    { status: 'UNAVAILABLE' },
    'RETRY_LATER',
  );

/** Whole years between a calendar date and "today" in India. */
function ageBandFrom(dob: unknown, yearOfBirth: unknown, now: Date): AgeBand {
  const ist = new Date(now.getTime() + 330 * 60_000); // IST has no DST
  const ty = ist.getUTCFullYear();
  const tm = ist.getUTCMonth() + 1;
  const td = ist.getUTCDate();
  if (typeof dob === 'string') {
    const dmy = dob.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/); // documented format: DD-MM-YYYY
    const ymd = dob.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parts = dmy
      ? [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])]
      : ymd
        ? [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])]
        : null;
    if (parts) {
      const [y, m, d] = parts as [number, number, number];
      const real = new Date(Date.UTC(y, m - 1, d));
      if (
        y >= 1900 &&
        y <= ty &&
        real.getUTCFullYear() === y &&
        real.getUTCMonth() === m - 1 &&
        real.getUTCDate() === d
      ) {
        const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
        return age >= 18 ? 'ADULT' : 'MINOR';
      }
    }
  }
  // only a year: decide only when the answer is the same for every birthday in that year
  const yob =
    typeof yearOfBirth === 'number'
      ? yearOfBirth
      : typeof yearOfBirth === 'string' && /^\d{4}$/.test(yearOfBirth)
        ? Number(yearOfBirth)
        : null;
  if (yob !== null && Number.isInteger(yob) && yob >= 1900 && yob <= ty) {
    if (ty - yob > 18) return 'ADULT';
    if (ty - yob < 18) return 'MINOR';
  }
  return null;
}

/**
 * Cashfree Secure ID — Aadhaar through DigiLocker. The Advisor signs in on DigiLocker's own page and consents there;
 * nothing identity-related is typed into KBS.
 *
 *   start    → `POST /verification/digilocker` (Aadhaar only) → the DigiLocker URL (valid 10 minutes)
 *   complete → `GET /verification/digilocker?verification_id=…` (PENDING / AUTHENTICATED / EXPIRED / CONSENT_DENIED),
 *              then `GET /verification/digilocker/document/AADHAAR?verification_id=…`
 *
 * REQ-10 / REQ-21 data minimisation: the Aadhaar document is read once, reduced IN MEMORY to
 * `{ method, verifiedNameMatch, ageBand }` and dropped. The Aadhaar number (masked or not), photo, address, date of
 * birth, gender, care-of, mobile and the raw response never reach the return value, a log line or an error. Only `name`,
 * `dob`, `year_of_birth`, `status` and `reference_id` are read from the document at all.
 *
 * Stateless: the profile name is passed again at `complete` as `payload: { fullName }`. One attempt per call, no retry.
 */
export class CashfreeDigilockerKycAdapter implements KycProvider {
  readonly name = 'cashfree';
  readonly method = 'DIGILOCKER_AADHAAR';
  private readonly logger = new Logger('KYC');
  constructor(private readonly cfg: CashfreeDigilockerConfig) {}

  async start(_input: { userId: string; consentAt: Date; fullName?: string }) {
    // KBS-generated, unique, no PII: 36 characters (limit 50; letters, digits, '.', '-', '_' allowed)
    const verificationId = `kbs-${randomUUID().replace(/-/g, '')}`;
    const r = await cashfreeRequest(this.cfg, {
      method: 'POST',
      path: '/digilocker',
      body: {
        verification_id: verificationId,
        document_requested: ['AADHAAR'],
        redirect_url: `${this.cfg.apiPublicUrl.replace(/\/+$/, '')}${DIGILOCKER_RETURN_PATH}`,
        user_flow: 'signup', // works with and without an existing DigiLocker account (Cashfree's default)
        company_name: DIGILOCKER_COMPANY_NAME,
      },
    });
    const url =
      r.kind === 'response' && r.status === 200 && typeof r.body?.url === 'string'
        ? r.body.url
        : '';
    if (!/^https:\/\/[^\s]+$/.test(url)) {
      this.logger.error(
        `[cashfree-digilocker] session not created: ${r.kind === 'response' && r.status === 200 ? 'HTTP 200 without an https url' : describeFailure(r)}`,
      );
      throw unavailableToStart();
    }
    // the URL itself is a one-time link for this person: not logged
    this.logger.log(
      `[cashfree-digilocker] session ${verificationId} created (ref ${cashfreeReferenceId((r as Extract<CashfreeResult, { kind: 'response' }>).body) ?? 'none'})`,
    );
    return { sessionRef: verificationId, instructions: INSTRUCTIONS, actionUrl: url };
  }

  async complete(input: { sessionRef: string; payload: unknown }): Promise<KycResult> {
    const sessionRef = input.sessionRef;
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(sessionRef)) {
      this.logger.warn(
        '[cashfree-digilocker] FAILED: SESSION_NOT_FOUND (malformed session id, not sent to the provider)',
      );
      return {
        status: 'FAILED',
        providerRef: 'invalid-session',
        evidenceSummary: {
          method: this.method,
          verifiedNameMatch: null,
          ageBand: null,
          reason: 'SESSION_NOT_FOUND',
        },
      };
    }
    const p = input.payload;
    const fullName =
      p && typeof p === 'object' && typeof (p as { fullName?: unknown }).fullName === 'string'
        ? (p as { fullName: string }).fullName.trim()
        : '';
    if (!fullName) return this.failed(sessionRef, null, 'PROFILE_NAME_MISSING');

    // 1. has the Advisor finished on DigiLocker?
    const s = await cashfreeRequest(this.cfg, {
      method: 'GET',
      path: '/digilocker',
      query: { verification_id: sessionRef },
    });
    if (s.kind !== 'response') return this.unavailable(sessionRef, `status: ${describeFailure(s)}`);
    if (this.isUnknownSession(s)) return this.failed(sessionRef, null, 'SESSION_NOT_FOUND');
    if (s.status !== 200 || !s.body)
      return this.unavailable(sessionRef, `status: ${describeFailure(s)}`);
    let ref = cashfreeReferenceId(s.body);
    const state = typeof s.body.status === 'string' ? s.body.status.toUpperCase() : '';
    if (state === 'PENDING') return this.pending(sessionRef);
    if (state === 'EXPIRED') return this.failed(sessionRef, ref, 'LINK_EXPIRED');
    if (state === 'CONSENT_DENIED') return this.failed(sessionRef, ref, 'CONSENT_DENIED');
    if (state !== 'AUTHENTICATED')
      return this.unavailable(
        sessionRef,
        'status: HTTP 200 with a status this adapter does not know',
      );

    // 2. the Aadhaar document — read, reduced, dropped
    const d = await cashfreeRequest(this.cfg, {
      method: 'GET',
      path: '/digilocker/document/AADHAAR',
      query: { verification_id: sessionRef },
    });
    if (d.kind !== 'response')
      return this.unavailable(sessionRef, `document: ${describeFailure(d)}`);
    if (d.status === 202) return this.pending(sessionRef); // "validation_pending": Cashfree is still fetching it
    if (this.isUnknownSession(d)) return this.failed(sessionRef, ref, 'SESSION_NOT_FOUND');
    if (d.status === 400) {
      const reason = (
        {
          url_expired: 'LINK_EXPIRED',
          session_expired: 'CONSENT_SESSION_EXPIRED',
          consent_not_granted: 'DOCUMENT_CONSENT_NOT_GIVEN',
          user_detail_mismatch: 'PROVIDER_DETAIL_MISMATCH',
        } as Record<string, DigilockerFailureReason>
      )[cashfreeCode(d.body) ?? ''];
      if (reason) return this.failed(sessionRef, ref, reason);
    }
    if (d.status !== 200 || !d.body)
      return this.unavailable(sessionRef, `document: ${describeFailure(d)}`);
    ref = cashfreeReferenceId(d.body) ?? ref;
    const docStatus = typeof d.body.status === 'string' ? d.body.status.toUpperCase() : '';
    if (docStatus === 'AADHAAR_NOT_LINKED')
      return this.failed(sessionRef, ref, 'DOCUMENT_NOT_LINKED');
    if (docStatus !== 'SUCCESS')
      return this.unavailable(
        sessionRef,
        'document: HTTP 200 with a status this adapter does not know',
      );

    const documentName = typeof d.body.name === 'string' ? d.body.name : '';
    const ageBand = ageBandFrom(d.body.dob, d.body.year_of_birth, this.cfg.now?.() ?? new Date());
    if (!documentName.trim()) return this.failed(sessionRef, ref, 'NAME_NOT_READABLE', { ageBand });
    const verifiedNameMatch = namesMatch(documentName, fullName);
    if (!verifiedNameMatch)
      return this.failed(sessionRef, ref, 'NAME_MISMATCH', { verifiedNameMatch, ageBand });
    if (ageBand === null)
      return this.failed(sessionRef, ref, 'AGE_UNKNOWN', { verifiedNameMatch, ageBand });
    if (ageBand === 'MINOR')
      return this.failed(sessionRef, ref, 'MINOR', { verifiedNameMatch, ageBand });

    this.logger.log(`[cashfree-digilocker] session ${sessionRef} VERIFIED (ref ${ref ?? 'none'})`);
    return {
      status: 'VERIFIED',
      providerRef: ref ?? sessionRef,
      evidenceSummary: { method: this.method, verifiedNameMatch: true, ageBand: 'ADULT' },
    };
  }

  /**
   * Cashfree answers 404 `not_found_error` for an id it does not know. A 404 without that body is something else
   * (DigiLocker not activated on the account answers 404 too) and must stay UNAVAILABLE.
   */
  private isUnknownSession(r: Extract<CashfreeResult, { kind: 'response' }>): boolean {
    return (
      r.status === 404 &&
      r.body?.type === 'not_found_error' &&
      cashfreeCode(r.body) === 'verification_id_value_invalid'
    );
  }

  private pending(sessionRef: string): KycResult {
    this.logger.log(`[cashfree-digilocker] session ${sessionRef} PENDING`);
    return { status: 'PENDING', providerRef: sessionRef, evidenceSummary: { method: this.method } };
  }

  private failed(
    sessionRef: string,
    ref: string | null,
    reason: DigilockerFailureReason,
    facts: { verifiedNameMatch?: boolean; ageBand?: AgeBand } = {},
  ): KycResult {
    this.logger.warn(
      `[cashfree-digilocker] session ${sessionRef} FAILED: ${reason} (ref ${ref ?? 'none'})`,
    );
    return {
      status: 'FAILED',
      providerRef: ref ?? sessionRef,
      evidenceSummary: {
        method: this.method,
        verifiedNameMatch: facts.verifiedNameMatch ?? null,
        ageBand: facts.ageBand ?? null,
        reason,
      },
    };
  }

  /** `providerRef` stays the session id so the same session can be completed again once the provider is back. */
  private unavailable(sessionRef: string, why: string): KycResult {
    this.logger.error(`[cashfree-digilocker] session ${sessionRef} UNAVAILABLE — ${why}`);
    return {
      status: 'UNAVAILABLE',
      providerRef: sessionRef,
      evidenceSummary: { method: this.method },
    };
  }
}
