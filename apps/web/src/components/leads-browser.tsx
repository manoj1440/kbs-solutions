import {
  FILTER_AWAITING,
  FILTER_NOT_REPORTED,
  type LeadFilterOptions,
  type LeadStatusRow,
  LEAD_SORTS,
  MIS_FRESHNESS,
} from '@kbs/shared';
import { ChevronLeft, ChevronRight, Filter, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

import { LeadsTable } from '@/components/leads-table';
import { Button } from '@/components/ui/button';
import { Field, MiniStat, selectClass } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export type LeadsSearch = Partial<
  Record<
    | 'q'
    | 'bankId'
    | 'cardId'
    | 'from'
    | 'to'
    | 'stage'
    | 'decision'
    | 'activation'
    | 'misFreshness'
    | 'actionable'
    | 'sort'
    | 'page'
    | 'advisorId',
    string
  >
>;

const SORT_LABEL: Record<(typeof LEAD_SORTS)[number], string> = {
  createdAt_desc: 'Newest lead first',
  createdAt_asc: 'Oldest lead first',
  lastMatchedAt_desc: 'Latest MIS match first',
  lastMatchedAt_asc: 'Stalest MIS match first',
  customer_asc: 'Customer A→Z',
};
const FRESH_LABEL: Record<(typeof MIS_FRESHNESS)[number], string> = {
  never: 'Never matched',
  recent: 'Matched in last 7 days',
  older7d: 'Older than 7 days',
  older30d: 'Older than 30 days',
};

interface Summary {
  total: number;
  matched: number;
  awaitingMis: number;
  approved: number;
  declined: number;
  inProcess: number;
  decisionBlank: number;
  cardsActive: number;
  cardsInactive: number;
  activationBlank: number;
}

/**
 * F-408 → F-810 — compact leads browser: cumulative tiles, one filter row (+ "More filters" disclosure),
 * 50/page table with internal scroll. Status values are bank-verbatim (`/leads/filters`), never a fixed list.
 */
export async function LeadsBrowser({ basePath, sp, title }: { basePath: string; sp: LeadsSearch; title: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const [list, filters, summary] = await Promise.all([
    apiFetch<LeadStatusRow[]>(`/leads?${qs.toString()}`),
    apiFetch<LeadFilterOptions>('/leads/filters'),
    apiFetch<Summary>('/leads/summary').then((r) => r.data),
  ]);
  const total = Number(list.meta.total ?? 0);
  const page = Number(sp.page ?? '1');
  const pages = Math.max(1, Math.ceil(total / 50));
  const pageHref = (p: number) => {
    const q = new URLSearchParams(qs);
    q.delete('pageSize');
    q.set('page', String(p));
    return `${basePath}?${q.toString()}`;
  };
  const filtered = Boolean(sp.q || sp.bankId || sp.cardId || sp.stage || sp.decision || sp.activation || sp.from || sp.to || sp.misFreshness || sp.actionable);
  const advanced = (['from', 'to', 'stage', 'decision', 'activation', 'misFreshness', 'actionable'] as const).filter((k) => sp[k]).length;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">{title}</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Leads" value={summary.total.toLocaleString('en-IN')} hint={filtered ? `${total} match the filters` : `${summary.matched} matched to bank MIS`} tone="sky" />
        <MiniStat label="Approved" value={summary.approved} hint="Bank decision = approved" tone="emerald" />
        <MiniStat label="Declined" value={summary.declined} hint="Bank decision = declined/rejected" tone="rose" />
        <MiniStat label="In process" value={summary.inProcess} hint="Decision reported, not final" tone="amber" />
        <MiniStat label="Cards active" value={summary.cardsActive} hint={`${summary.cardsInactive} reported inactive`} tone="teal" />
        <MiniStat label="Awaiting MIS" value={summary.awaitingMis} hint={`No accepted MIS row · ${summary.decisionBlank} matched w/o decision`} tone="slate" />
      </div>

      <section aria-label={title} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <form method="get" action={basePath} aria-label="Search & filters" className="border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 p-3">
            <input aria-label="Search" name="q" className={cn(selectClass, 'h-9 min-w-44 flex-[2_1_12rem]')} defaultValue={sp.q ?? ''} placeholder="Name, mobile, KBS-L-…, bank application no." />
            <select aria-label="Bank" name="bankId" className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')} defaultValue={sp.bankId ?? ''}>
              <option value="">All banks</option>
              {filters.data.banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
            <select aria-label="Card" name="cardId" className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')} defaultValue={sp.cardId ?? ''}>
              <option value="">All cards</option>
              {filters.data.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select aria-label="Sort" name="sort" className={cn(selectClass, 'h-9 min-w-36 flex-[1_1_9rem]')} defaultValue={sp.sort ?? 'createdAt_desc'}>
              {LEAD_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" className="h-9">
              <Filter />
              Apply
            </Button>
            {filtered ? (
              <Button asChild size="sm" variant="ghost" className="h-9">
                <Link href={basePath}>Reset</Link>
              </Button>
            ) : null}
          </div>
          <details open={advanced > 0} className="group border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 select-none">
              <SlidersHorizontal className="size-3.5 text-slate-400" aria-hidden="true" />
              More filters
              {advanced ? <span className="rounded-full bg-teal-600 px-1.5 text-[10.5px] font-semibold text-white tabular-nums">{advanced}</span> : null}
              <ChevronRight className="ml-auto size-4 text-slate-400 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Created from" htmlFor="from">
                <input id="from" name="from" type="date" defaultValue={sp.from ?? ''} className={cn(selectClass, 'h-9')} />
              </Field>
              <Field label="Created to" htmlFor="to">
                <input id="to" name="to" type="date" defaultValue={sp.to ?? ''} className={cn(selectClass, 'h-9')} />
              </Field>
              <Field label="MIS freshness" htmlFor="misFreshness">
                <select id="misFreshness" name="misFreshness" defaultValue={sp.misFreshness ?? ''} className={cn(selectClass, 'h-9')}>
                  <option value="">Any</option>
                  {MIS_FRESHNESS.map((f) => (
                    <option key={f} value={f}>
                      {FRESH_LABEL[f]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Actionable" htmlFor="actionable">
                <select id="actionable" name="actionable" defaultValue={sp.actionable ?? ''} className={cn(selectClass, 'h-9')}>
                  <option value="">Any</option>
                  <option value="true">Needs advisor action</option>
                  <option value="false">No pending action</option>
                </select>
              </Field>
              {(
                [
                  ['stage', 'Stage', filters.data.stages],
                  ['decision', 'Decision', filters.data.decisions],
                  ['activation', 'Activation', filters.data.activations],
                ] as const
              ).map(([name, label, values]) => (
                <Field key={name} label={label} htmlFor={name}>
                  <select id={name} name={name} defaultValue={sp[name] ?? ''} className={cn(selectClass, 'h-9')}>
                    <option value="">Any</option>
                    <option value={FILTER_AWAITING}>Awaiting MIS Update</option>
                    <option value={FILTER_NOT_REPORTED}>Not reported</option>
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </details>
          {sp.advisorId ? <input type="hidden" name="advisorId" value={sp.advisorId} /> : null}
        </form>
        <div className="min-h-0 flex-1">
          <LeadsTable rows={list.data} basePath={basePath} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-500 tabular-nums">
            {total ? `${((page - 1) * 50 + 1).toLocaleString('en-IN')}–${Math.min(page * 50, total).toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}` : '0 leads'} · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={pageHref(page - 1)}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={pageHref(page + 1)}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
