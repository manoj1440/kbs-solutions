import { describe, expect, it } from 'vitest';

import { callAttention, OversightCallsQuery, shareDeliveryLabel } from '../src';

const now = new Date('2026-09-23T12:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const base = { providerState: 'ENDED' as const, providerCallId: 'p1', initiatedAt: minsAgo(10), connectedAt: minsAgo(9), endedAt: minsAgo(8), recordingStatus: 'AVAILABLE' as const };

describe('F-314 oversight rules', () => {
  it('flags a live call only after the 30-minute window', () => {
    expect(callAttention({ ...base, providerState: 'RINGING', connectedAt: null, endedAt: null, recordingStatus: null, initiatedAt: minsAgo(29) }, now)).toEqual([]);
    expect(callAttention({ ...base, providerState: 'REQUESTED', connectedAt: null, endedAt: null, recordingStatus: null, initiatedAt: minsAgo(31) }, now)).toEqual(['NO_PROVIDER_CONFIRMATION']);
  });

  it('separates failures before the provider from provider-reported failures', () => {
    expect(callAttention({ ...base, providerState: 'FAILED', providerCallId: null, connectedAt: null, recordingStatus: null }, now)).toEqual(['FAILED_BEFORE_PROVIDER']);
    expect(callAttention({ ...base, providerState: 'FAILED', providerCallId: 'p9', connectedAt: null, recordingStatus: null }, now)).toEqual([]);
  });

  it('CALL-02 recording failed / overdue; available is never flagged', () => {
    expect(callAttention(base, now)).toEqual([]);
    expect(callAttention({ ...base, recordingStatus: 'FAILED' }, now)).toEqual(['RECORDING_FAILED']);
    expect(callAttention({ ...base, recordingStatus: 'PENDING' }, now)).toEqual([]);
    expect(callAttention({ ...base, recordingStatus: 'PENDING', endedAt: minsAgo(61) }, now)).toEqual(['RECORDING_OVERDUE']);
    expect(callAttention({ ...base, recordingStatus: null, endedAt: minsAgo(90) }, now)).toEqual(['RECORDING_OVERDUE']);
    // a call that never connected has nothing to record
    expect(callAttention({ ...base, providerState: 'NO_ANSWER', connectedAt: null, recordingStatus: null, endedAt: minsAgo(90) }, now)).toEqual([]);
  });

  it('WA-01 hand-off is never labelled delivered', () => {
    expect(shareDeliveryLabel('WHATSAPP_HANDOFF', 'OPENED', 'UNKNOWN')).toBe('Hand-off only — delivery not reported');
    expect(shareDeliveryLabel('WHATSAPP_HANDOFF', 'FAILED', 'UNKNOWN')).toBe('Could not open share');
    expect(shareDeliveryLabel('WHATSAPP_BUSINESS_API', 'OPENED', 'UNKNOWN')).toBe('Awaiting provider status');
    expect(shareDeliveryLabel('WHATSAPP_BUSINESS_API', 'OPENED', 'DELIVERED')).toBe('Delivered (provider)');
    expect(shareDeliveryLabel('WHATSAPP_BUSINESS_API', 'OPENED', 'FAILED')).toBe('Delivery failed (provider)');
  });

  it('query defaults and validation', () => {
    expect(OversightCallsQuery.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(OversightCallsQuery.safeParse({ from: '23-09-2026' }).success).toBe(false);
    expect(OversightCallsQuery.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});
