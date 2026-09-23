import {
  FILTER_AWAITING,
  FILTER_NOT_REPORTED,
  type LeadFilterOptions,
  type LeadStatusRow,
  LEAD_SORTS,
  MIS_FRESHNESS,
} from '@kbs/shared';
import Link from 'next/link';

import { LeadsTable } from '@/components/leads-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
 */
export async function LeadsBrowser({
  basePath,
  sp,
  title,
  description,
}: {
  basePath: string;
  sp: LeadsSearch;
  title: string;
  description: string;
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
  const sel = 'border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm';
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Search & filters</CardTitle>
          <CardDescription>
            Search by customer name, mobile or KBS / bank reference. Status filters list the exact
            values banks have reported.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action={basePath} className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            <div className="grid gap-1 md:col-span-2">
              <Label htmlFor="q">Search</Label>
              <Input
                id="q"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Name, mobile, KBS-L-…, bank application no."
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="bankId">Bank</Label>
              <select id="bankId" name="bankId" defaultValue={sp.bankId ?? ''} className={sel}>
                <option value="">All banks</option>
                {filters.data.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cardId">Card</Label>
              <select id="cardId" name="cardId" defaultValue={sp.cardId ?? ''} className={sel}>
                <option value="">All cards</option>
                {filters.data.cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="from">Created from</Label>
              <Input id="from" name="from" type="date" defaultValue={sp.from ?? ''} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="to">Created to</Label>
              <Input id="to" name="to" type="date" defaultValue={sp.to ?? ''} />
            </div>
            {(
              [
                ['stage', 'Stage', filters.data.stages],
                ['decision', 'Decision', filters.data.decisions],
                ['activation', 'Activation', filters.data.activations],
              ] as const
            ).map(([name, label, values]) => (
              <div key={name} className="grid gap-1">
                <Label htmlFor={name}>{label}</Label>
                <select id={name} name={name} defaultValue={sp[name] ?? ''} className={sel}>
                  <option value="">Any</option>
                  <option value={FILTER_AWAITING}>Awaiting MIS Update</option>
                  <option value={FILTER_NOT_REPORTED}>Not reported</option>
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="grid gap-1">
              <Label htmlFor="misFreshness">MIS freshness</Label>
              <select
                id="misFreshness"
                name="misFreshness"
                defaultValue={sp.misFreshness ?? ''}
                className={sel}
              >
                <option value="">Any</option>
                {MIS_FRESHNESS.map((f) => (
                  <option key={f} value={f}>
                    {FRESH_LABEL[f]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="actionable">Actionable</Label>
              <select
                id="actionable"
                name="actionable"
                defaultValue={sp.actionable ?? ''}
                className={sel}
              >
                <option value="">Any</option>
                <option value="true">
                  Needs advisor action (no MIS match, no verified reference)
                </option>
                <option value="false">No pending action</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="sort">Sort</Label>
              <select
                id="sort"
                name="sort"
                defaultValue={sp.sort ?? 'createdAt_desc'}
                className={sel}
              >
                {LEAD_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            {sp.advisorId ? <input type="hidden" name="advisorId" value={sp.advisorId} /> : null}
            <div className="flex items-end gap-2">
              <Button type="submit">Apply</Button>
              <Button asChild variant="ghost">
                <Link href={basePath}>Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {total} lead{total === 1 ? '' : 's'}
          </CardTitle>
          <CardDescription>
            Stage, decision and activation are independent bank-reported fields. Use “More detail”
            for references, dates and raw bank values, or switch to the full sortable table.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <LeadsTable rows={list.data} basePath={basePath} />
          {pages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page - 1)}>Previous</Link>
                </Button>
              ) : null}
              <span className="text-muted-foreground">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page + 1)}>Next</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
