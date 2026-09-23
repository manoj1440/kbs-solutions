import { describe, expect, it } from 'vitest';

import { payoutSummarySchema, summarizeBanks } from '../src/lib/admin-overview';

const bank = (
  total: number,
  neverMatched: number,
  older7: number,
  older30: number,
  quarantine = 0,
) => ({
  leads: { total, neverMatched, matchedOlderThan7d: older7, matchedOlderThan30d: older30 },
  quarantine,
  rows: { invalid: 0 },
});

describe('Admin overview: trustworthy business summaries', () => {
  it('uses all-bank totals, not the recent leads page, and keeps stale MIS separate from unmatched', () => {
    expect(summarizeBanks([bank(180, 30, 40, 20, 4), bank(20, 10, 5, 2, 1)])).toEqual({
      leads: 200,
      matched: 160,
      neverMatched: 40,
      stale: 45,
      quarantine: 5,
      invalid: 0,
      coverage: 80,
    });
  });

  it('does not claim perfect coverage with no business', () => {
    expect(summarizeBanks([]).coverage).toBeNull();
    expect(summarizeBanks([bank(0, 0, 0, 0)]).matched).toBe(0);
  });

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
