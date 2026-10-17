'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import { formatValue, SERIES_STROKE, type NumberFormat } from './charts';
import { TONE, type Tone } from './kit';

/**
 * F-814 area/line chart in plain SVG (no chart library — ADR-003). The first visible series is
 * filled, the others are lines. Hover or ←/→ shows every series' value; the peak of the first
 * visible series is marked; a screen-reader table carries all numbers.
 */
export type TrendSeries = { key: string; label: string; tone: Tone; values: number[] };

const FILL: Partial<Record<Tone, string>> = {
  teal: 'fill-teal-500/12',
  indigo: 'fill-indigo-500/12',
  sky: 'fill-sky-500/12',
  violet: 'fill-violet-500/12',
  amber: 'fill-amber-500/12',
  rose: 'fill-rose-500/12',
  emerald: 'fill-emerald-500/12',
};

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

export function TrendChart({
  labels,
  series,
  format = 'number',
  height = 220,
  title,
  className,
}: {
  labels: string[];
  series: TrendSeries[];
  format?: NumberFormat;
  height?: number;
  title: string;
  className?: string;
}) {
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [active, setActive] = React.useState<number | null>(null);
  const visible = series.filter((s) => !hidden.includes(s.key));
  const n = labels.length;
  const max = niceMax(Math.max(0, ...visible.flatMap((s) => s.values)));
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const lead = visible[0];
  const peak = lead && Math.max(...lead.values) > 0 ? lead.values.indexOf(Math.max(...lead.values)) : -1;
  const ticks = [max, max / 2, 0];
  const step = Math.max(1, Math.ceil(n / 7));

  function pick(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setActive(Math.round(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * (n - 1)));
  }
  function key(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setActive((a) => Math.min(Math.max((a ?? (e.key === 'ArrowLeft' ? n : -1)) + (e.key === 'ArrowLeft' ? -1 : 1), 0), n - 1));
  }

  return (
    <figure className={cn('grid gap-3', className)}>
      <figcaption className="flex flex-wrap items-center gap-1.5">
        <span className="sr-only">{title}</span>
        {series.map((s) => {
          const on = !hidden.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => setHidden((h) => (on ? (visible.length > 1 ? [...h, s.key] : h) : h.filter((k) => k !== s.key)))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                on ? 'border-border bg-card text-foreground' : 'border-transparent bg-muted text-muted-foreground line-through',
              )}
            >
              <span className={cn('size-2 rounded-full', TONE[s.tone].bar)} aria-hidden="true" />
              {s.label}
            </button>
          );
        })}
      </figcaption>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div className="flex flex-col justify-between text-right text-[10.5px] text-muted-foreground tabular-nums" style={{ height }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatValue(t, format)}
            </span>
          ))}
        </div>
        <div
          className="relative touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md"
          style={{ height }}
          tabIndex={0}
          role="group"
          aria-label={`${title}. Use left and right arrow keys to read each point.`}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={key}
          onBlur={() => setActive(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            {ticks.map((t) => (
              <line key={t} x1={0} x2={100} y1={y(t)} y2={y(t)} className="stroke-border-subtle" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {lead && n > 1 ? <path d={`${line(lead.values)} L100,100 L0,100 Z`} className={FILL[lead.tone] ?? 'fill-muted'} /> : null}
            {visible.map((s) => (
              <path key={s.key} d={line(s.values)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={SERIES_STROKE[s.tone]} />
            ))}
            {active != null ? <line x1={x(active)} x2={x(active)} y1={0} y2={100} className="stroke-border-strong" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
          </svg>

          {peak >= 0 && active == null ? (
            <div className="pointer-events-none absolute -translate-x-1/2" style={{ left: `${x(peak)}%`, top: `${y(lead.values[peak])}%` }}>
              <span className={cn('block size-2.5 -translate-y-1/2 rounded-full ring-2 ring-card', TONE[lead.tone].bar)} />
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-foreground shadow-card tabular-nums">
                Peak {formatValue(lead.values[peak], format)}
              </span>
            </div>
          ) : null}

          {active != null
            ? visible.map((s) => (
                <span
                  key={s.key}
                  className={cn('pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card', TONE[s.tone].bar)}
                  style={{ left: `${x(active)}%`, top: `${y(s.values[active])}%` }}
                />
              ))
            : null}

          {active != null ? (
            <div
              role="status"
              className={cn(
                'pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-pop',
                x(active) > 60 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
              )}
              style={{ left: `${x(active)}%` }}
            >
              <div className="mb-1 font-semibold text-foreground">{labels[active]}</div>
              {visible.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-fg-2">
                    <span className={cn('size-1.5 rounded-full', TONE[s.tone].bar)} aria-hidden="true" />
                    {s.label}
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">{formatValue(s.values[active], format)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div />
        <div className="relative mt-1.5 h-4 text-[10.5px] text-muted-foreground" aria-hidden="true">
          {labels.map((l, i) =>
            i === n - 1 || (i % step === 0 && n - 1 - i >= step / 2) ? (
              <span
                key={i}
                className={cn('absolute whitespace-nowrap', i === 0 ? '' : i === n - 1 ? '-translate-x-full' : '-translate-x-1/2')}
                style={{ left: `${x(i)}%` }}
              >
                {l}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={i}>
              <th scope="row">{l}</th>
              {series.map((s) => (
                <td key={s.key}>{formatValue(s.values[i] ?? 0, format)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
