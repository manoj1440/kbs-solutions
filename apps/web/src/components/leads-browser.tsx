import {
  FILTER_AWAITING,
  FILTER_NOT_REPORTED,
  type LeadFilterOptions,
  type LeadStatusRow,
  LEAD_SORTS,
  MIS_FRESHNESS,
} from '@kbs/shared';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  ListChecks,
  type LucideIcon,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';

import { LeadsTable } from '@/components/leads-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, PageHeader, SectionCard, selectClass, StatCard, StatGrid, type Tone } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

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

/**
 * F-408 — server-rendered leads browser (search, filters, sort, paging via the URL) on top of the F-506 table.
 * Filter values are the bank's verbatim strings from `/leads/filters`, never a fixed list.
 * F-806: compact filter bar — search + key filters visible, the rest in a native "More filters" disclosure (still one GET form).
 */
export async function LeadsBrowser({
  basePath,
  sp,
  title,
  description,
  eyebrow = 'Workspace',
  icon = ListChecks,
  tone = 'teal',
}: {
  basePath: string;
  sp: LeadsSearch;
  title: string;
  description: string;
  eyebrow?: string;
  icon?: LucideIcon;
  tone?: Tone;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const [list, filters] = await Promise.all([
    apiFetch<LeadStatusRow[]>(`/leads?${qs.toString()}`),
    apiFetch<LeadFilterOptions>('/leads/filters'),
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
  const withoutHref = (key: keyof LeadsSearch) => {
    const q = new URLSearchParams(qs);
    q.delete('pageSize');
    q.delete('page');
    q.delete(key);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const statusLabel = (v: string) => (v === FILTER_AWAITING ? 'Awaiting MIS Update' : v === FILTER_NOT_REPORTED ? 'Not reported' : v);
  const active = (
    [
      ['q', 'Search', sp.q],
      ['bankId', 'Bank', filters.data.banks.find((b) => b.id === sp.bankId)?.displayName ?? sp.bankId],
      ['cardId', 'Card', filters.data.cards.find((c) => c.id === sp.cardId)?.name ?? sp.cardId],
      ['from', 'Created from', sp.from],
      ['to', 'Created to', sp.to],
      ['stage', 'Stage', sp.stage && statusLabel(sp.stage)],
      ['decision', 'Decision', sp.decision && statusLabel(sp.decision)],
      ['activation', 'Activation', sp.activation && statusLabel(sp.activation)],
      ['misFreshness', 'MIS freshness', sp.misFreshness && (FRESH_LABEL[sp.misFreshness as (typeof MIS_FRESHNESS)[number]] ?? sp.misFreshness)],
      ['actionable', 'Actionable', sp.actionable && (sp.actionable === 'true' ? 'Needs advisor action' : 'No pending action')],
    ] as const
  ).filter(([, , v]) => v);
  const advanced = (['from', 'to', 'stage', 'decision', 'activation', 'misFreshness', 'actionable'] as const).filter((k) => sp[k]).length;
  const rows = list.data;
  const matched = rows.filter((r) => r.matched).length;
  const scope = total > rows.length ? `Of the ${rows.length} leads on this page` : 'Across the listed leads';
  return (
    <div className="grid gap-6">
      <PageHeader icon={icon} eyebrow={eyebrow} tone={tone} title={title} description={description}>
        <StatGrid className="xl:grid-cols-3">
          <StatCard
            label={active.length ? 'Matching leads' : 'Leads'}
            value={total.toLocaleString('en-IN')}
            hint={active.length ? `${active.length} filter${active.length === 1 ? '' : 's'} applied` : 'All leads you can see'}
            icon={ListChecks}
            tone="sky"
          />
          <StatCard label="Matched to bank MIS" value={matched} hint={scope} icon={FileCheck2} tone="indigo" />
          <StatCard
            label="Awaiting MIS Update"
            value={rows.length - matched}
            hint={`${scope} · no accepted MIS row yet`}
            icon={Clock3}
            tone={rows.length - matched ? 'amber' : 'slate'}
            className="col-span-2 xl:col-span-1"
          />
        </StatGrid>
      </PageHeader>
      <form
        method="get"
        action={basePath}
        aria-label="Search & filters"
        className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)] sm:p-5"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
          <Field label="Search" htmlFor="q" className="md:col-span-2 xl:col-span-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                id="q"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Name, mobile, KBS-L-…, bank application no."
                className="h-10 pl-9"
              />
            </div>
          </Field>
          <Field label="Bank" htmlFor="bankId">
            <select id="bankId" name="bankId" defaultValue={sp.bankId ?? ''} className={selectClass}>
              <option value="">All banks</option>
              {filters.data.banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Card" htmlFor="cardId">
            <select id="cardId" name="cardId" defaultValue={sp.cardId ?? ''} className={selectClass}>
              <option value="">All cards</option>
              {filters.data.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort" htmlFor="sort">
            <select id="sort" name="sort" defaultValue={sp.sort ?? 'createdAt_desc'} className={selectClass}>
              {LEAD_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" className="h-10">
              <Search />
              Apply
            </Button>
            <Button asChild variant="ghost" className="h-10">
              <Link href={basePath}>Clear</Link>
            </Button>
          </div>
        </div>
        <details open={advanced > 0} className="group rounded-xl border border-slate-200/80 bg-slate-50/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-slate-700 select-none">
            <SlidersHorizontal className="size-4 text-slate-500" aria-hidden="true" />
            More filters
            {advanced ? (
              <span className="rounded-full bg-teal-600 px-1.5 text-[10.5px] font-semibold text-white tabular-nums">{advanced}</span>
            ) : null}
            <span className="ml-auto hidden text-xs font-normal text-slate-500 sm:inline">Dates, bank status, MIS freshness, actionable</span>
            <ChevronRight className="size-4 text-slate-400 transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="grid gap-3 border-t border-slate-200/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Created from" htmlFor="from">
              <Input id="from" name="from" type="date" defaultValue={sp.from ?? ''} className="h-10" />
            </Field>
            <Field label="Created to" htmlFor="to">
              <Input id="to" name="to" type="date" defaultValue={sp.to ?? ''} className="h-10" />
            </Field>
            <Field label="MIS freshness" htmlFor="misFreshness">
              <select id="misFreshness" name="misFreshness" defaultValue={sp.misFreshness ?? ''} className={selectClass}>
                <option value="">Any</option>
                {MIS_FRESHNESS.map((f) => (
                  <option key={f} value={f}>
                    {FRESH_LABEL[f]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Actionable" htmlFor="actionable">
              <select id="actionable" name="actionable" defaultValue={sp.actionable ?? ''} className={selectClass}>
                <option value="">Any</option>
                <option value="true">Needs advisor action (no MIS match, no verified reference)</option>
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
                <select id={name} name={name} defaultValue={sp[name] ?? ''} className={selectClass}>
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
            <p className="self-end text-[11.5px] leading-relaxed text-slate-500 sm:col-span-2 lg:col-span-1">
              Search by customer name, mobile or KBS / bank reference. Status filters list the exact
              values banks have reported.
            </p>
          </div>
        </details>
        {sp.advisorId ? <input type="hidden" name="advisorId" value={sp.advisorId} /> : null}
        {active.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-500">Active filters</span>
            {active.map(([key, label, value]) => (
              <Link
                key={key}
                href={withoutHref(key)}
                prefetch={false}
                aria-label={`Remove filter ${label}: ${value}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-teal-50 py-1 pr-1.5 pl-2.5 text-teal-900 ring-1 ring-teal-100 ring-inset hover:bg-teal-100"
              >
                <span className="text-teal-700">{label}:</span>
                <span className="truncate font-medium">{value}</span>
                <X className="size-3.5 shrink-0 text-teal-700" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : null}
      </form>
      <SectionCard
        icon={ListChecks}
        tone="sky"
        title={`${total} lead${total === 1 ? '' : 's'}`}
        description="Stage, decision and activation are independent bank-reported fields. Use “More detail” for references, dates and raw bank values, or switch to the full sortable table."
        bodyClassName="grid gap-4"
      >
        <LeadsTable rows={list.data} basePath={basePath} />
        {pages > 1 ? (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
            <span className="text-slate-500 tabular-nums">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft />
                    Previous
                  </Link>
                </Button>
              ) : null}
              {page < pages ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page + 1)}>
                    Next
                    <ChevronRight />
                  </Link>
                </Button>
              ) : null}
            </div>
          </nav>
        ) : null}
      </SectionCard>
    </div>
  );
}
