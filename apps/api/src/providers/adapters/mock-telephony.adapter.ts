import { randomUUID } from 'node:crypto';

import type { TelephonyEvent, TelephonyProvider } from '../ports';

/** Simulates a provider. Events are produced by POSTing to the dev webhook with { events: [...] }. */
export class MockTelephonyAdapter implements TelephonyProvider {
  readonly name = 'mock';
  async initiateCall(input: { fromUserId: string; toMobileE164: string; callbackUrl: string }) {
    if (input.toMobileE164.endsWith('0000')) return { providerCallId: `mock-${randomUUID()}`, state: 'FAILED' as const, reason: 'MOCK_FAILURE' };
    return { providerCallId: `mock-${randomUUID()}`, state: 'REQUESTED' as const };
  }
  parseWebhook(_headers: Record<string, string | string[] | undefined>, body: unknown): TelephonyEvent[] {
    const b = body as { events?: Array<Partial<TelephonyEvent> & { at?: string }> };
    return (b.events ?? []).map((e) => ({
      providerCallId: String(e.providerCallId),
      type: e.type as TelephonyEvent['type'],
      at: e.at ? new Date(e.at) : new Date(),
      durationSec: e.durationSec,
      recordingRef: e.recordingRef,
      reason: e.reason,
    }));
  }
}
