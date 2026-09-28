// ── F-811 business-home periods (IST calendar days, inclusive; the API reads from/to as IST days) ──
export const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
] as const;
export type PeriodKey = (typeof PERIODS)[number]['key'] | 'custom';
export interface Range {
  from: string;
  to: string;
}
export interface Period {
  key: PeriodKey;
  label: string;
  current: Partial<Range>;
}

const DAY = 86_400_000;
const IST = 5.5 * 3_600_000;
const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => istDay(Date.parse(`${day}T00:00:00+05:30`) + n * DAY);

/** Selected window. Explicit from/to wins over the picker; default is today (IST). */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, now = Date.now()): Period {
  const today = istDay(now);
  if (sp.from || sp.to) {
    return { key: 'custom', label: 'Custom', current: { ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) } };
  }
  const found = PERIODS.find((p) => p.key === sp.period);
  const key = found ? found.key : 'today';
  const label = found?.label ?? 'Today';
  if (key === 'today') return { key, label, current: { from: today, to: today } };
  if (key === 'week') {
    // Monday of the current IST week → today
    const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
    return { key, label, current: { from: addDays(today, -dow), to: today } };
  }
  return { key, label, current: { from: addDays(today, key === '30d' ? -29 : -89), to: today } };
}
