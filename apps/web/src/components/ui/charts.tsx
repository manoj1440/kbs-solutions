import * as React from 'react';

import { cn } from '@/lib/utils';

import { TONE, type Tone } from './kit';

/**
 * F-814 server-safe data visuals (no hooks). Every visual carries its numbers as text too —
 * REQ-20 §20.2: never colour alone. The interactive area chart is `TrendChart` (trend-chart.tsx).
 */

export type NumberFormat = 'number' | 'inr';

const nf = new Intl.NumberFormat('en-IN');
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
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
    text = `↑ new`;
    mood = goodWhen === 'up' ? 'good' : 'bad';
  } else {
    const pct = Math.round((Math.abs(diff) / Math.abs(previous)) * 100);
    text = `${diff > 0 ? '↑' : '↓'} ${pct}%`;
    mood = diff > 0 === (goodWhen === 'up') ? 'good' : 'bad';
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs leading-none font-semibold tabular-nums',
        mood === 'good'
          ? 'bg-emerald-50 text-emerald-700'
          : mood === 'bad'
            ? 'bg-rose-50 text-rose-700'
            : 'bg-muted text-fg-2',
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
  teal: 'stroke-neutral-900',
  indigo: 'stroke-neutral-800',
  sky: 'stroke-sky-500',
  violet: 'stroke-neutral-800',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  emerald: 'stroke-emerald-500',
  slate: 'stroke-fg-3',
};
export const SERIES_STROKE = STROKE;

/** Recent history of one number. Decorative only when the same numbers are shown elsewhere — give it a label. */
export function Sparkline({
  values,
  tone = 'teal',
  label,
  className,
}: {
  values: number[];
  tone?: Tone;
  label: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28 - 1}`)
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn('h-8 w-full overflow-visible', className)}
    >
      <polyline
        points={pts}
        fill="none"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={STROKE[tone]}
      />
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
                {item.hint ? (
                  <span className="ml-1.5 font-normal text-muted-foreground">{item.hint}</span>
                ) : null}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn('h-full rounded-full', TONE[item.tone ?? 'teal'].bar)}
                style={{ width: `${Math.max(pct, item.value ? 2 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * F-817 reference chart: stacked columns (bottom = `base`, top = `rest`), y-grid with 5 ticks, x labels thinned to fit.
 * Server-safe; the numbers are also in a visually hidden table (REQ-20 §20.2).
 */
export function StackedBars({
  labels,
  base,
  rest,
  baseLabel,
  restLabel,
  title,
  className,
}: {
  labels: string[];
  base: number[];
  rest: number[];
  baseLabel: string;
  restLabel: string;
  title: string;
  className?: string;
}) {
  const totals = labels.map((_, i) => (base[i] ?? 0) + (rest[i] ?? 0));
  const raw = Math.max(1, ...totals);
  const step = Math.max(1, Math.ceil(raw / 4));
  const top = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((k) => k * step);
  const every = Math.max(1, Math.ceil(labels.length / 6));
  return (
    <figure className={cn('grid gap-2', className)}>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2" aria-hidden="true">
        <div className="flex h-44 flex-col justify-between text-2xs text-muted-foreground tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {nf.format(t)}
            </span>
          ))}
        </div>
        <div className="relative h-44">
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((t) => (
              <span key={t} className="border-t border-dashed border-border" />
            ))}
          </div>
          <div className="relative flex h-full items-end gap-[6%] px-[2%]">
            {labels.map((l, i) => {
              const b = base[i] ?? 0;
              const r = rest[i] ?? 0;
              return (
                <div
                  key={`${l}-${i}`}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={`${l}: ${baseLabel} ${nf.format(b)} · ${restLabel} ${nf.format(r)}`}
                >
                  {r > 0 ? (
                    <div
                      className="brand-hatch rounded-t-md"
                      style={{ height: `${(r / top) * 100}%` }}
                    />
                  ) : null}
                  {b > 0 ? (
                    <div
                      className={cn('bg-foreground', r > 0 ? 'rounded-b-md' : 'rounded-md')}
                      style={{ height: `${(b / top) * 100}%` }}
                    />
                  ) : null}
                  {b === 0 && r === 0 ? (
                    <div className="h-0.5 rounded-full bg-surface-strong" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2" aria-hidden="true">
        <span />
        <div className="flex gap-[6%] px-[2%]">
          {labels.map((l, i) => (
            <span
              key={`${l}-${i}`}
              className="flex min-w-0 flex-1 justify-center overflow-visible text-2xs whitespace-nowrap text-muted-foreground"
            >
              {i % every === 0 ? l : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">{baseLabel}</th>
              <th scope="col">{restLabel}</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((l, i) => (
              <tr key={`${l}-${i}`}>
                <th scope="row">{l}</th>
                <td>{base[i] ?? 0}</td>
                <td>{rest[i] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
