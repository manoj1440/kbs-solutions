import { describe, expect, it } from 'vitest';

import { resolvePeriod } from '../src/lib/admin-overview';

// 2026-03-31 10:00 IST
const NOW = Date.parse('2026-03-31T10:00:00+05:30');

describe('Admin overview: business periods', () => {
  it('defaults to today (IST)', () => {
    expect(resolvePeriod({}, NOW)).toEqual({ key: 'today', current: { from: '2026-03-31', to: '2026-03-31' } });
  });

  it('uses the IST calendar day, not UTC', () => {
    // 2026-04-01 01:00 IST is still 31 Mar in UTC
    expect(resolvePeriod({ period: 'today' }, Date.parse('2026-04-01T01:00:00+05:30'))).toEqual({
      key: 'today',
      current: { from: '2026-04-01', to: '2026-04-01' },
    });
  });

  it('rolling windows and month-to-date resolve to the right ranges', () => {
    expect(resolvePeriod({ period: '7d' }, NOW).current).toEqual({ from: '2026-03-25', to: '2026-03-31' });
    expect(resolvePeriod({ period: 'mtd' }, NOW).current).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(resolvePeriod({ period: '30d' }, NOW).current).toEqual({ from: '2026-03-02', to: '2026-03-31' });
  });

  it('all time is unbounded; explicit dates win over period', () => {
    expect(resolvePeriod({ period: 'all' }, NOW)).toEqual({ key: 'all', current: {} });
    expect(resolvePeriod({ period: '7d', from: '2026-01-10' }, NOW)).toEqual({ key: 'custom', current: { from: '2026-01-10' } });
    expect(resolvePeriod({ from: '2026-01-10', to: '2026-01-19' }, NOW)).toEqual({ key: 'custom', current: { from: '2026-01-10', to: '2026-01-19' } });
    expect(resolvePeriod({ period: 'bogus' }, NOW).key).toBe('today');
  });
});
