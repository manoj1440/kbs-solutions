import { describe, expect, it } from 'vitest';

import { resolvePeriod } from '../src/lib/admin-overview';

// 2026-03-31 10:00 IST (a Tuesday)
const NOW = Date.parse('2026-03-31T10:00:00+05:30');

describe('Admin overview: business periods', () => {
  it('defaults to today (IST)', () => {
    expect(resolvePeriod({}, NOW)).toEqual({ key: 'today', label: 'Today', current: { from: '2026-03-31', to: '2026-03-31' } });
  });

  it('uses the IST calendar day, not UTC', () => {
    // 2026-04-01 01:00 IST is still 31 Mar in UTC
    expect(resolvePeriod({ period: 'today' }, Date.parse('2026-04-01T01:00:00+05:30')).current).toEqual({ from: '2026-04-01', to: '2026-04-01' });
  });

  it('this week starts Monday and runs to today', () => {
    // Tuesday 2026-03-31 → Monday 2026-03-30
    expect(resolvePeriod({ period: 'week' }, NOW).current).toEqual({ from: '2026-03-30', to: '2026-03-31' });
    // Sunday 2026-04-05 → Monday 6 days earlier
    expect(resolvePeriod({ period: 'week' }, Date.parse('2026-04-05T12:00:00+05:30')).current).toEqual({ from: '2026-03-30', to: '2026-04-05' });
    // Monday itself → same day
    expect(resolvePeriod({ period: 'week' }, Date.parse('2026-04-06T09:00:00+05:30')).current).toEqual({ from: '2026-04-06', to: '2026-04-06' });
  });

  it('30d and 90d are inclusive spans ending today', () => {
    expect(resolvePeriod({ period: '30d' }, NOW).current).toEqual({ from: '2026-03-02', to: '2026-03-31' });
    expect(resolvePeriod({ period: '90d' }, NOW).current).toEqual({ from: '2026-01-01', to: '2026-03-31' });
  });

  it('explicit dates win over period; unknown keys fall back to today', () => {
    expect(resolvePeriod({ period: '30d', from: '2026-01-10' }, NOW)).toEqual({ key: 'custom', label: 'Custom', current: { from: '2026-01-10' } });
    expect(resolvePeriod({ from: '2026-01-10', to: '2026-01-19' }, NOW)).toEqual({ key: 'custom', label: 'Custom', current: { from: '2026-01-10', to: '2026-01-19' } });
    expect(resolvePeriod({ period: 'bogus' }, NOW).key).toBe('today');
  });
});
