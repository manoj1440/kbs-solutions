import { z } from 'zod';

export interface BankOverview {
  bank: { id: string; code: string; displayName: string };
  lastUploadAt: string | null;
  lastAppliedAt: string | null;
  leads: {
    total: number;
    neverMatched: number;
    matchedOlderThan7d: number;
    matchedOlderThan30d: number;
  };
  rows: { invalid: number };
  quarantine: number;
}

export function summarizeBanks(banks: Pick<BankOverview, 'leads' | 'rows' | 'quarantine'>[]) {
  const totals = banks.reduce(
    (sum, bank) => ({
      leads: sum.leads + bank.leads.total,
      matched: sum.matched + bank.leads.total - bank.leads.neverMatched,
      neverMatched: sum.neverMatched + bank.leads.neverMatched,
      stale: sum.stale + bank.leads.matchedOlderThan7d,
      quarantine: sum.quarantine + bank.quarantine,
      invalid: sum.invalid + bank.rows.invalid,
    }),
    { leads: 0, matched: 0, neverMatched: 0, stale: 0, quarantine: 0, invalid: 0 },
  );
  return {
    ...totals,
    coverage: totals.leads ? Math.round((totals.matched / totals.leads) * 100) : null,
  };
}

const count = z.number().int().nonnegative();
const amount = z.number().nonnegative();
export const payoutSummarySchema = z.object({
  counts: z.object({
    eligible: count,
    available: count,
    availableToClaim: count,
    reserved: count,
    paid: count,
    pendingHold: count,
    underReview: count,
    void: count,
  }),
  amounts: z.object({
    available: amount,
    reserved: amount,
    paid: amount,
    pendingHold: amount,
    underReview: amount,
  }),
});
