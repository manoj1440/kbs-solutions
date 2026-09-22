import { randomUUID } from 'node:crypto';

import type { KycProvider } from '../ports';

/** Mock identity verification. Completes with payload 'MOCK_OK'; anything else fails. Never returns an Aadhaar number. */
export class MockKycAdapter implements KycProvider {
  readonly name = 'mock';
  readonly method = 'MOCK_OFFLINE_VERIFICATION';
  async start(input: { userId: string; consentAt: Date }) {
    return { sessionRef: `kyc-${randomUUID()}`, instructions: `Mock KYC session for ${input.userId} (consent ${input.consentAt.toISOString()}). Submit payload MOCK_OK.` };
  }
  async complete(input: { sessionRef: string; payload: unknown }) {
    const ok = input.payload === 'MOCK_OK';
    return {
      status: ok ? ('VERIFIED' as const) : ('FAILED' as const),
      providerRef: input.sessionRef,
      evidenceSummary: { method: this.method, verifiedNameMatch: ok, ageBand: ok ? 'ADULT' : null },
    };
  }
}
