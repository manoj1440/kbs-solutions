/**
 * F-606 — one classifier for every payout view (REQ-17 §17.9: reconcile Advisor, Manager, Admin and Accounts from the
 * same ledger). An entitlement is in exactly one bucket; `eligible` is the union of the MIS-eligible buckets.
 */
export const LEDGER_BUCKETS = ['pendingHold', 'available', 'requested', 'approvedUnpaid', 'onHold', 'paid', 'underReview', 'void'] as const;
export type LedgerBucket = (typeof LEDGER_BUCKETS)[number];
export const ELIGIBLE_BUCKETS: readonly LedgerBucket[] = ['pendingHold', 'available', 'requested', 'approvedUnpaid', 'onHold', 'paid'];

export function bucketOf(entitlementState: string, requestState: string | null | undefined): LedgerBucket {
  switch (entitlementState) {
    case 'PENDING_HOLD':
      return 'pendingHold';
    case 'ELIGIBLE_AVAILABLE':
      return 'available';
    case 'PAID':
      return 'paid';
    case 'UNDER_REVIEW':
      return 'underReview';
    case 'VOID':
      return 'void';
    default:
      if (requestState === 'APPROVED' || requestState === 'PAYMENT_RECORDED_PENDING_PROOF') return 'approvedUnpaid';
      if (requestState === 'ON_HOLD') return 'onHold';
      return 'requested';
  }
}

export type Tot = { count: number; amountInr: number };
export function emptyTotals(): Record<LedgerBucket | 'eligible', Tot> {
  return Object.fromEntries([...LEDGER_BUCKETS, 'eligible'].map((b) => [b, { count: 0, amountInr: 0 }])) as Record<LedgerBucket | 'eligible', Tot>;
}

/** Sums in paise to avoid float drift, then converts back to rupees. */
export function totalsOf(rows: { bucket: LedgerBucket; amountInr: number }[]) {
  const paise = emptyTotals();
  for (const r of rows) {
    const p = Math.round(r.amountInr * 100);
    paise[r.bucket].count += 1;
    paise[r.bucket].amountInr += p;
    if (ELIGIBLE_BUCKETS.includes(r.bucket)) {
      paise.eligible.count += 1;
      paise.eligible.amountInr += p;
    }
  }
  for (const k of Object.keys(paise) as (keyof typeof paise)[]) paise[k].amountInr = paise[k].amountInr / 100;
  return paise;
}
