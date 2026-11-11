import { PAN_REGEX } from '@kbs/shared';
import { Logger } from '@nestjs/common';

import type { PanVerificationProvider } from '../ports';

import {
  cashfreeCode,
  cashfreeReferenceId,
  cashfreeRequest,
  type CashfreeVerificationConfig,
  describeFailure,
} from './cashfree-verification.client';
import { namesMatch } from './name-match';

export interface CashfreePanConfig extends CashfreeVerificationConfig {
  /** `x-api-version` for the PAN call (documented as optional; Cashfree recommends 2024-08-01). */
  apiVersion?: string;
}

export const CASHFREE_PAN_API_VERSION = '2024-08-01';

/** Cashfree's own name-match categories (PAN "name match score" feature). The first two count as the same person. */
const NAME_MATCHED = new Set(['DIRECT_MATCH', 'GOOD_PARTIAL_MATCH']);
const NAME_NOT_MATCHED = new Set(['MODERATE_PARTIAL_MATCH', 'POOR_PARTIAL_MATCH', 'NO_MATCH']);

type PanResult = Awaited<ReturnType<PanVerificationProvider['verify']>>;

/** Cashfree accepts only letters, digits, space, dot, hyphen, slash and ampersand in `name`. */
const nameForRequest = (name: string) =>
  name
    .replace(/[^\p{L}\p{N} .\-/&]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Cashfree Secure ID — Verify PAN (sync): `POST /verification/pan` with `{ pan, name }`.
 *
 *   valid PAN + name matches            → VERIFIED
 *   valid PAN + name does not match     → MISMATCH
 *   PAN invalid / not found / inactive  → FAILED
 *   timeout, network, 401/403, 422 (wallet), 429, 5xx, anything unexpected → UNAVAILABLE (an outage must never look like a bad PAN)
 *
 * Name match: Cashfree's own `name_match_result` when the account has that feature (DIRECT_MATCH / GOOD_PARTIAL_MATCH =
 * match). Without it, `registered_name` is compared in memory with the strict rule in name-match.ts and then dropped.
 * The registered name is never returned or logged; neither are the PAN, the customer name, the secret or the signature.
 * `providerRef` is Cashfree's numeric `reference_id`. One attempt, no retry.
 */
export class CashfreePanAdapter implements PanVerificationProvider {
  readonly name = 'cashfree';
  private readonly logger = new Logger('PAN');
  constructor(private readonly cfg: CashfreePanConfig) {}

  async verify(input: { pan: string; name?: string }): Promise<PanResult> {
    const pan = input.pan.trim().toUpperCase();
    if (!PAN_REGEX.test(pan)) return { status: 'FAILED', providerRef: null }; // not sent: Cashfree would answer 400
    const name = input.name ? nameForRequest(input.name) : '';

    const r = await cashfreeRequest(this.cfg, {
      method: 'POST',
      path: '/pan',
      body: name ? { pan, name } : { pan },
      apiVersion: this.cfg.apiVersion ?? CASHFREE_PAN_API_VERSION,
    });
    if (r.kind !== 'response') return this.unavailable(describeFailure(r), null);
    const ref = cashfreeReferenceId(r.body);

    if (r.status === 400 && /^pan_/.test(cashfreeCode(r.body) ?? '')) {
      this.logger.warn(
        `[cashfree-pan] FAILED: provider refused the PAN format (HTTP 400 ${cashfreeCode(r.body)})`,
      );
      return { status: 'FAILED', providerRef: ref };
    }
    if (r.status !== 200 || !r.body) return this.unavailable(describeFailure(r), null);

    const body = r.body;
    if (typeof body.valid !== 'boolean')
      return this.unavailable('HTTP 200 without a `valid` flag', ref);
    // `pan_status` (VALID / INVALID / DELETED / DEACTIVATED) is only present on newer API versions; when present it must agree
    const active =
      body.valid &&
      (typeof body.pan_status !== 'string' || body.pan_status.toUpperCase() === 'VALID');
    if (!active) {
      this.logger.log(`[cashfree-pan] FAILED: PAN not valid (ref ${ref ?? 'none'})`);
      return { status: 'FAILED', providerRef: ref };
    }
    if (!name) {
      this.logger.log(
        `[cashfree-pan] VERIFIED: PAN valid, no name to compare (ref ${ref ?? 'none'})`,
      );
      return { status: 'VERIFIED', providerRef: ref };
    }

    const result =
      typeof body.name_match_result === 'string' ? body.name_match_result.toUpperCase() : '';
    let matched: boolean;
    let basis: string;
    if (NAME_MATCHED.has(result) || NAME_NOT_MATCHED.has(result)) {
      matched = NAME_MATCHED.has(result);
      basis = `provider ${result}`;
    } else if (typeof body.registered_name === 'string' && body.registered_name.trim()) {
      matched = namesMatch(body.registered_name, name); // compared in memory, never kept
      basis = 'registered-name comparison';
    } else {
      return this.unavailable(
        'PAN valid but the provider returned nothing to compare the name with',
        ref,
      );
    }
    this.logger.log(
      `[cashfree-pan] ${matched ? 'VERIFIED' : 'MISMATCH'}: PAN valid, name ${matched ? 'matches' : 'does not match'} — ${basis} (ref ${ref ?? 'none'})`,
    );
    return { status: matched ? 'VERIFIED' : 'MISMATCH', providerRef: ref };
  }

  private unavailable(why: string, ref: string | null): PanResult {
    this.logger.error(`[cashfree-pan] UNAVAILABLE: ${why}`);
    return { status: 'UNAVAILABLE', providerRef: ref };
  }
}
