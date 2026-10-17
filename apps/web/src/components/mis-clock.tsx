'use client';

import { formatDate, formatDateTime, type MisFreshness } from '@kbs/shared';
import { ChevronRight, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/** "12 min ago" … "3 days ago", then the date (exact time on hover). */
export function sinceLabel(iso: string, now: number) {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d <= 7 ? `${d} day${d === 1 ? '' : 's'} ago` : formatDate(iso);
}

/**
 * F-814 signature move: bank values are only as fresh as the last accepted MIS import, so every workspace shows it —
 * per bank, never one global "live" status (REQ-20 §20.3, REQ-16 §16.3). Sits on the navy sidebar / drawer.
 */
export function MisClock({ freshness, href }: { freshness: MisFreshness | null; href?: string }) {
  // the server's clock (layout render time) keeps SSR and hydration identical; tick every minute after that
  const [now, setNow] = useState(() => (freshness ? Date.parse(freshness.asOf) : 0));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!freshness) {
    return <p className="mx-3 mb-3 rounded-xl px-3 py-2.5 text-2xs text-white/50 ring-1 ring-white/10">Bank MIS freshness unavailable.</p>;
  }
  const reported = freshness.banks
    .filter((b): b is typeof b & { lastAppliedAt: string } => b.lastAppliedAt != null)
    .sort((a, b) => b.lastAppliedAt.localeCompare(a.lastAppliedAt));
  const latest = reported[0];

  return (
    <details className="group mx-3 mb-3 rounded-xl bg-white/[0.04] ring-1 ring-white/10 open:bg-white/[0.06]">
      <summary
        className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-teal-300"
        title="Bank values are the latest accepted MIS only — never live bank status."
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-300/10 text-teal-300 ring-1 ring-teal-300/20">
          <FileSpreadsheet className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xs text-white/55">Bank MIS</span>
          <span className="block truncate text-ui font-semibold text-white/90">
            {latest ? `${latest.bankCode} · ${sinceLabel(latest.lastAppliedAt, now)}` : 'No import yet'}
          </span>
          <span className="block text-2xs text-white/55 tabular-nums">
            {reported.length} of {freshness.banks.length} banks imported
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-white/40 transition-transform group-open:-rotate-90" aria-hidden="true" />
      </summary>
      <ul className="max-h-48 overflow-y-auto border-t border-white/10 px-3 py-2" aria-label="Last accepted MIS import per bank">
        {freshness.banks.map((b) => (
          <li key={b.bankCode} className="flex items-baseline justify-between gap-3 py-1 text-xs">
            <span className="min-w-0 truncate text-white/75">{b.bankName}</span>
            <span
              className={cn('shrink-0 tabular-nums', b.lastAppliedAt ? 'text-white/90' : 'text-white/45')}
              title={b.lastAppliedAt ? formatDateTime(b.lastAppliedAt) : undefined}
            >
              {b.lastAppliedAt ? sinceLabel(b.lastAppliedAt, now) : 'Never imported'}
            </span>
          </li>
        ))}
      </ul>
      {href ? (
        <Link href={href} prefetch={false} className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-xs font-semibold text-teal-300 hover:bg-white/5">
          Open MIS imports
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </details>
  );
}
