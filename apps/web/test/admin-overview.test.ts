import { describe, expect, it } from 'vitest';

import { countSuccess, payoutSummarySchema, percentChange, resolvePeriod } from '../src/lib/admin-overview';

// 2026-03-31 10:00 IST
const NOW = Date.parse('2026-03-31T10:00:00+05:30');

describe('Admin overview: business periods', () => {
  it('defaults to month-to-date compared with the same days of last month, clamped to its end', () => {
    expect(resolvePeriod({}, NOW)).toEqual({
      key: 'mtd',
      current: { from: '2026-03-01', to: '2026-03-31' },
      previous: { from: '2026-02-01', to: '2026-02-28' },
    });
    expect(resolvePeriod({}, Date.parse('2026-03-05T00:10:00+05:30')).previous).toEqual({ from: '2026-02-01', to: '2026-02-05' });
  });

  it('uses the IST calendar day, not UTC', () => {
    // 2026-04-01 01:00 IST is still 31 Mar in UTC
    expect(resolvePeriod({ period: 'today' }, Date.parse('2026-04-01T01:00:00+05:30'))).toEqual({
      key: 'today',
      current: { from: '2026-04-01', to: '2026-04-01' },
      previous: { from: '2026-03-31', to: '2026-03-31' },
    });
  });

  it('rolling windows compare with the equal window just before', () => {
    expect(resolvePeriod({ period: '7d' }, NOW)).toMatchObject({ current: { from: '2026-03-25', to: '2026-03-31' }, previous: { from: '2026-03-18', to: '2026-03-24' } });
    expect(resolvePeriod({ period: '30d' }, NOW).current).toEqual({ from: '2026-03-02', to: '2026-03-31' });
  });

  it('all time and open custom ranges have nothing to compare with; explicit dates win over period', () => {
    expect(resolvePeriod({ period: 'all' }, NOW)).toEqual({ key: 'all', current: {}, previous: null });
    expect(resolvePeriod({ period: '7d', from: '2026-01-10' }, NOW)).toEqual({ key: 'custom', current: { from: '2026-01-10' }, previous: null });
    expect(resolvePeriod({ from: '2026-01-10', to: '2026-01-19' }, NOW).previous).toEqual({ from: '2025-12-31', to: '2026-01-09' });
    expect(resolvePeriod({ period: 'bogus' }, NOW).key).toBe('mtd');
  });

  it('percent change never divides by zero', () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(5, null)).toBeNull();
  });

  it('INV-02 success counts use bank values verbatim; unknown buckets never count', () => {
    const decision = [
      { value: 'APPROVE', count: 4 },
      { value: 'DECLINE', count: 2 },
      { value: 'Awaiting MIS', count: 9 },
      { value: 'Not reported', count: 3 },
    ];
    expect(countSuccess('decision', decision)).toBe(4);
    expect(countSuccess('activation', [{ value: 'ACTIVE', count: 2 }, { value: 'INACTIVE', count: 5 }, { value: 'Not reported', count: 1 }])).toBe(2);
  });
});

describe('Admin overview: payout ledger summary', () => {
  it('INV-06 preserves overlapping eligibility and reservation counts without summing them', () => {
    const summary = payoutSummarySchema.parse({
      counts: {
        eligible: 3,
        available: 1,
        availableToClaim: 1,
        reserved: 1,
        paid: 1,
        pendingHold: 0,
        underReview: 2,
        void: 0,
      },
      amounts: { available: 1500, reserved: 1500, paid: 1500, pendingHold: 0, underReview: 3000 },
    });
    expect(summary.counts.eligible).toBe(3);
    expect(summary.amounts.reserved).toBe(1500);
    expect(summary.counts.underReview).toBe(2);
  });

  it('rejects missing or invalid metadata instead of presenting unavailable totals as zero', () => {
    expect(payoutSummarySchema.safeParse({}).success).toBe(false);
    expect(payoutSummarySchema.safeParse({ counts: { eligible: '12' } }).success).toBe(false);
  });
});
