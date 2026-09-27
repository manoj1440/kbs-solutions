import { statusTone, type StatusKind } from '@kbs/shared';
import { z } from 'zod';

// ── F-807 business-home periods (IST calendar days, inclusive; the API reads from/to as IST days) ──
export const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: 'mtd', label: 'This month' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
] as const;
export type PeriodKey = (typeof PERIODS)[number]['key'] | 'custom';
export interface Range {
  from: string;
  to: string;
}
export interface Period {
  key: PeriodKey;
  current: Partial<Range>;
  previous: Range | null;
}

const DAY = 86_400_000;
const IST = 5.5 * 3_600_000;
const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => istDay(Date.parse(`${day}T00:00:00+05:30`) + n * DAY);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
const last = (n: number, today: string): Range => ({ from: addDays(today, 1 - n), to: today });
const before = (r: Range): Range => {
  const n = daysBetween(r.from, r.to);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
};

/** Selected window and the window it is compared with. Explicit from/to wins; default is month-to-date. */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, now = Date.now()): Period {
  const today = istDay(now);
  if (sp.from || sp.to) {
    const current = { ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) };
    const valid = sp.from && sp.to && sp.from <= sp.to;
    return { key: 'custom', current, previous: valid ? before({ from: sp.from!, to: sp.to! }) : null };
  }
  const key = (PERIODS.some((p) => p.key === sp.period) ? sp.period : 'mtd') as PeriodKey;
  if (key === 'all') return { key, current: {}, previous: null };
  if (key === 'mtd') {
    const from = `${today.slice(0, 8)}01`;
    const prevFrom = addDays(from, -1).slice(0, 8) + '01';
    const prevLast = addDays(from, -1);
    // same number of days into last month, clamped to its last day (31 Mar → 28/29 Feb)
    const prevTo = addDays(prevFrom, daysBetween(from, today) - 1);
    return { key, current: { from, to: today }, previous: { from: prevFrom, to: prevTo > prevLast ? prevLast : prevTo } };
  }
  const current = last(key === 'today' ? 1 : key === '7d' ? 7 : 30, today);
  return { key, current, previous: before(current) };
}

/** % change vs previous; null when there is no base to compare with (previous 0 or unavailable). */
export function percentChange(current: number, previous: number | null | undefined) {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Leads whose latest MIS value the shared tone vocabulary marks as success (decision APPROVE, activation active). */
export function countSuccess(kind: StatusKind, buckets: { value: string; count: number }[]) {
  return buckets.reduce(
    (n, b) =>
      statusTone(kind, { value: b.value, raw: b.value, display: b.value, provenance: 'BANK_MIS', asOf: null, batchRef: null }) ===
      'success'
        ? n + b.count
        : n,
    0,
  );
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
