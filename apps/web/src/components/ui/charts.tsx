import * as React from 'react';

import { cn } from '@/lib/utils';

import { TONE, type Tone } from './kit';

/**
 * F-814 server-safe data visuals (no hooks). Every visual carries its numbers as text too —
 * REQ-20 §20.2: never colour alone. The interactive area chart is `TrendChart` (trend-chart.tsx).
 */

export type NumberFormat = 'number' | 'inr';

const nf = new Intl.NumberFormat('en-IN');
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export function formatValue(v: number, format: NumberFormat = 'number') {
  return format === 'inr' ? inr.format(v) : nf.format(v);
}

/** Change vs the previous period as text ("▲ 12%"). `goodWhen` picks which direction is green. */
export function DeltaBadge({
  current,
  previous,
  goodWhen = 'up',
  suffix = 'vs prev.',
  className,
}: {
  current: number;
  previous: number | null | undefined;
  goodWhen?: 'up' | 'down';
  suffix?: string;
  className?: string;
}) {
  if (previous == null) return null;
  const diff = current - previous;
  let text: string;
  let mood: 'good' | 'bad' | 'flat';
  if (diff === 0) {
    text = '— no change';
    mood = 'flat';
  } else if (previous === 0) {
    text = `▲ new`;
    mood = goodWhen === 'up' ? 'good' : 'bad';
  } else {
    const pct = Math.round((Math.abs(diff) / Math.abs(previous)) * 100);
    text = `${diff > 0 ? '▲' : '▼'} ${pct}%`;
    mood = (diff > 0) === (goodWhen === 'up') ? 'good' : 'bad';
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs leading-none font-semibold tabular-nums',
        mood === 'good' ? 'bg-emerald-50 text-emerald-700' : mood === 'bad' ? 'bg-rose-50 text-rose-700' : 'bg-muted text-fg-2',
        className,
      )}
      title={`${formatValue(current)} now, ${formatValue(previous)} in the previous period`}
    >
      {text}
      {diff !== 0 && suffix ? <span className="font-medium opacity-80">{suffix}</span> : null}
    </span>
  );
}

const STROKE: Record<Tone, string> = {
  teal: 'stroke-teal-600',
  indigo: 'stroke-indigo-500',
  sky: 'stroke-sky-500',
  violet: 'stroke-violet-500',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  emerald: 'stroke-emerald-500',
  slate: 'stroke-fg-3',
};
export const SERIES_STROKE = STROKE;

/** Recent history of one number. Decorative only when the same numbers are shown elsewhere — give it a label. */
export function Sparkline({ values, tone = 'teal', label, className }: { values: number[]; tone?: Tone; label: string; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28 - 1}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label} className={cn('h-8 w-full overflow-visible', className)}>
      <polyline points={pts} fill="none" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={STROKE[tone]} />
    </svg>
  );
}

/** Ranked horizontal bars with the value and share as text (funnels, mixes, per-caller counts). */
export function MiniBars({
  items,
  format = 'number',
  className,
}: {
  items: { label: React.ReactNode; value: number; tone?: Tone; hint?: React.ReactNode }[];
  format?: NumberFormat;
  className?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 0);
  return (
    <ul className={cn('grid gap-2.5', className)}>
      {items.map((item, i) => {
        const pct = max ? Math.round((item.value / max) * 100) : 0;
        return (
          <li key={i} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-fg-2">{item.label}</span>
              <span className="shrink-0 font-semibold text-foreground tabular-nums">
                {formatValue(item.value, format)}
                {item.hint ? <span className="ml-1.5 font-normal text-muted-foreground">{item.hint}</span> : null}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className={cn('h-full rounded-full', TONE[item.tone ?? 'teal'].bar)} style={{ width: `${Math.max(pct, item.value ? 2 : 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
