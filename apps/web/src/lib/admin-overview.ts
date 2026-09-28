// ── F-807/F-811 business-home periods (IST calendar days, inclusive; the API reads from/to as IST days) ──
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
}

const DAY = 86_400_000;
const IST = 5.5 * 3_600_000;
const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => istDay(Date.parse(`${day}T00:00:00+05:30`) + n * DAY);
const last = (n: number, today: string): Range => ({ from: addDays(today, 1 - n), to: today });

/** Selected window. Explicit from/to wins over the period chip; default is today (IST). */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, now = Date.now()): Period {
  const today = istDay(now);
  if (sp.from || sp.to) {
    return { key: 'custom', current: { ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) } };
  }
  const key = (PERIODS.some((p) => p.key === sp.period) ? sp.period : 'today') as PeriodKey;
  if (key === 'all') return { key, current: {} };
  if (key === 'mtd') return { key, current: { from: `${today.slice(0, 8)}01`, to: today } };
  return { key, current: last(key === 'today' ? 1 : key === '7d' ? 7 : 30, today) };
}
