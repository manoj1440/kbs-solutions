import { formatDateTime } from '@kbs/shared';
import {
  CheckCircle2,
  Clock,
  FileSearch,
  FileSpreadsheet,
  Filter,
  Landmark,
  Link2Off,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BankMark,
  EmptyState,
  Field,
  humanize,
  Meter,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  TONE,
} from '@/components/ui/kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { AcknowledgeValues } from './acknowledge';
import { Quarantine } from './quarantine';

interface BankIntegrity {
  bank: { id: string; code: string; displayName: string };
  lastUploadAt: string | null;
  lastAppliedAt: string | null;
  batches: Record<string, number>;
  rows: {
    imported: number;
    matched: number;
    unmatched: number;
    invalid: number;
    conflicted: number;
    duplicate: number;
    ignored: number;
    pending: number;
  };
  newValuesPending: { field: string; values: string[] }[];
  duplicateKeys: number;
  correctionsUnderReview: number;
  leads: {
    total: number;
    neverMatched: number;
    matchedOlderThan7d: number;
    matchedOlderThan30d: number;
  };
  advisorReferencesNeverMatched: number;
  quarantine: number;
}
interface Profile {
  id: string;
  status: string;
  version: number;
  bank: { id: string };
}

/** Lead freshness + review figures for one bank (links go to the filtered leads list). */
function LeadFacts({ b, className }: { b: BankIntegrity; className?: string }) {
  return (
    <dl
      className={cn('grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px] sm:grid-cols-3', className)}
    >
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-500">Leads never matched</dt>
        <dd className="font-semibold tabular-nums">
          <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=never`}>
            {b.leads.neverMatched} of {b.leads.total}
          </Link>
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-500">Matched &gt;7d / &gt;30d</dt>
        <dd className="font-semibold tabular-nums">
          <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older7d`}>
            {b.leads.matchedOlderThan7d}
          </Link>{' '}
          /{' '}
          <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older30d`}>
            {b.leads.matchedOlderThan30d}
          </Link>
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-500">Duplicate keys</dt>
        <dd
          className={cn(
            'font-semibold tabular-nums',
            b.duplicateKeys ? 'text-amber-700' : 'text-slate-900',
          )}
        >
          {b.duplicateKeys}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-500">Advisor refs unverified</dt>
        <dd className="font-semibold text-slate-900 tabular-nums">
          {b.advisorReferencesNeverMatched}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-500">Under review</dt>
        <dd className="font-semibold text-slate-900 tabular-nums">{b.correctionsUnderReview}</dd>
      </div>
    </dl>
  );
}

/** F-507 Admin: MIS integrity & freshness (REQ-16 §16.2) — per-bank tiles, pending new values, quarantine. Freshness is per lead. */
export default async function MisIntegrityPage({
  searchParams,
}: {
  searchParams: Promise<{ bankId?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  const [d, profiles] = await Promise.all([
    apiFetch<{ generatedAt: string; banks: BankIntegrity[] }>(
      `/dashboards/mis-integrity?${qs.toString()}`,
    ),
    apiFetch<Profile[]>('/mis/profiles'),
  ]);
  const approvedProfile = (bankId: string) =>
    profiles.data
      .filter((p) => p.bank.id === bankId && p.status === 'APPROVED')
      .sort((a, b) => b.version - a.version)[0] ?? null;
  const tot = d.data.banks.reduce(
    (a, b) => ({
      imported: a.imported + b.rows.imported,
      matched: a.matched + b.rows.matched,
      quarantine: a.quarantine + b.quarantine,
      invalid: a.invalid + b.rows.invalid,
      never: a.never + b.leads.neverMatched,
      stale: a.stale + b.leads.matchedOlderThan30d,
      review: a.review + b.correctionsUnderReview,
      newValues: a.newValues + b.newValuesPending.reduce((n, v) => n + v.values.length, 0),
    }),
    {
      imported: 0,
      matched: 0,
      quarantine: 0,
      invalid: 0,
      never: 0,
      stale: 0,
      review: 0,
      newValues: 0,
    },
  );
  // presentation only: banks with nothing uploaded collapse to compact cards
  const idle = d.data.banks.filter(
    (b) =>
      !b.lastUploadAt && !b.lastAppliedAt && !b.rows.imported && !Object.keys(b.batches).length,
  );
  const active = d.data.banks.filter((b) => !idle.includes(b));
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Bank MIS"
        title="MIS integrity & freshness"
        description="Per-bank upload/apply recency, row outcomes, verbatim new values awaiting acknowledgement, duplicate keys, corrections under review. Freshness is measured per lead, never as one global date."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/mis">
              <FileSpreadsheet />
              MIS imports
            </Link>
          </Button>
        }
      >
        <StatGrid>
          <StatCard
            label="Rows imported"
            value={tot.imported.toLocaleString('en-IN')}
            hint="All banks"
            icon={Upload}
            tone="sky"
          />
          <StatCard
            label="Rows matched"
            value={tot.matched.toLocaleString('en-IN')}
            hint={`${pct(tot.matched, tot.imported)}% of imported rows`}
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label="In quarantine"
            value={tot.quarantine.toLocaleString('en-IN')}
            hint="Unmatched or conflicting rows"
            icon={ShieldAlert}
            tone={tot.quarantine ? 'amber' : 'slate'}
          />
          <StatCard
            label="Invalid rows"
            value={tot.invalid.toLocaleString('en-IN')}
            hint="No usable bank reference"
            icon={XCircle}
            tone={tot.invalid ? 'rose' : 'slate'}
          />
          <StatCard
            label="Leads never matched"
            value={tot.never.toLocaleString('en-IN')}
            hint="No bank MIS row yet"
            icon={Link2Off}
            tone={tot.never ? 'amber' : 'slate'}
          />
          <StatCard
            label="Leads matched > 30 days ago"
            value={tot.stale.toLocaleString('en-IN')}
            hint="Last MIS match over 30 days ago"
            icon={Clock}
            tone={tot.stale ? 'amber' : 'slate'}
          />
          <StatCard
            label="New values pending"
            value={tot.newValues.toLocaleString('en-IN')}
            hint="Verbatim, awaiting acknowledgement"
            icon={Sparkles}
            tone={tot.newValues ? 'violet' : 'slate'}
          />
          <StatCard
            label="Corrections under review"
            value={tot.review.toLocaleString('en-IN')}
            hint="All banks"
            icon={FileSearch}
            tone="indigo"
          />
        </StatGrid>
      </PageHeader>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]"
      >
        <Field label="Uploads from" htmlFor="from" className="w-full sm:w-44">
          <Input id="from" name="from" type="date" defaultValue={sp.from ?? ''} />
        </Field>
        <Field label="to" htmlFor="to" className="w-full sm:w-44">
          <Input id="to" name="to" type="date" defaultValue={sp.to ?? ''} />
        </Field>
        {sp.bankId ? <input type="hidden" name="bankId" value={sp.bankId} /> : null}
        <div className="flex gap-2">
          <Button type="submit" className="h-10">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="ghost" className="h-10">
            <Link href="/admin/mis/integrity">Clear</Link>
          </Button>
        </div>
      </form>
      <SectionCard
        icon={Landmark}
        tone="indigo"
        title="Per bank"
        description={`Generated ${formatDateTime(d.data.generatedAt)}. Row figures reconcile with batch totals.`}
      >
        {d.data.banks.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No bank data yet"
            description="Figures appear once a bank MIS batch is uploaded."
          />
        ) : (
          <div className="grid gap-5">
            {active.length ? (
              <div className={cn('grid gap-4', active.length > 1 && 'xl:grid-cols-2')}>
                {active.map((b) => {
                  const cov = pct(b.rows.matched, b.rows.imported);
                  return (
                    <article
                      key={b.bank.id}
                      className="grid min-w-0 gap-4 rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <BankMark code={b.bank.code} />
                          <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-semibold text-slate-900">
                              {b.bank.displayName}
                            </h3>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(b.batches).map(([s, n]) => (
                                <Badge key={s} variant="secondary">
                                  {humanize(s)} {n}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/mis?bankId=${b.bank.id}`}>Batches</Link>
                        </Button>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                          <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            <Upload className="size-3" aria-hidden="true" />
                            Last upload
                          </dt>
                          <dd className="mt-0.5 text-[13px] text-slate-900">
                            {b.lastUploadAt ? (
                              formatDateTime(b.lastUploadAt)
                            ) : (
                              <span className="text-muted-foreground">never</span>
                            )}
                          </dd>
                        </div>
                        <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                          <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Last applied
                          </dt>
                          <dd className="mt-0.5 text-[13px] text-slate-900">
                            {b.lastAppliedAt ? (
                              formatDateTime(b.lastAppliedAt)
                            ) : (
                              <span className="text-muted-foreground">never</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      <div className="grid gap-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                          <span className="font-medium text-slate-700">Imported / matched</span>
                          <span className="text-slate-500 tabular-nums">
                            <span className="font-semibold text-slate-900">{b.rows.imported}</span>{' '}
                            / <span className="font-semibold text-slate-900">{b.rows.matched}</span>{' '}
                            · {cov}% matched
                          </span>
                        </div>
                        <Meter
                          value={b.rows.matched}
                          max={b.rows.imported}
                          tone="emerald"
                          label={`${b.bank.displayName} rows matched`}
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                          Unmatched / conflict / invalid / dup / ignored
                        </p>
                        <div className="grid grid-cols-5 gap-1.5 text-center">
                          {(
                            [
                              ['Unmatched', b.rows.unmatched, 'amber'],
                              ['Conflict', b.rows.conflicted, 'rose'],
                              ['Invalid', b.rows.invalid, 'rose'],
                              ['Dup', b.rows.duplicate, 'slate'],
                              ['Ignored', b.rows.ignored, 'slate'],
                            ] as const
                          ).map(([label, n, tone]) => (
                            <div
                              key={label}
                              className={cn(
                                'min-w-0 rounded-lg px-1 py-1.5 ring-1 ring-inset',
                                n ? TONE[tone].tile : 'bg-white text-slate-400 ring-slate-200',
                              )}
                            >
                              <div className="text-base font-semibold tabular-nums">{n}</div>
                              <div className="truncate text-[10px] font-medium">{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <LeadFacts b={b} className="border-t border-slate-100 pt-3" />
                    </article>
                  );
                })}
              </div>
            ) : null}
            {idle.length ? (
              <div className="grid gap-3">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  No MIS uploaded yet · {idle.length} bank{idle.length === 1 ? '' : 's'}
                </p>
                <ul className="grid gap-2 md:hidden">
                  {idle.map((b) => (
                    <li
                      key={b.bank.id}
                      className="grid gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <BankMark code={b.bank.code} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {b.bank.displayName}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              Last upload / applied: never / never · {b.rows.imported} imported
                            </p>
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/mis?bankId=${b.bank.id}`}>Batches</Link>
                        </Button>
                      </div>
                      <p className="text-[11px] leading-5 text-slate-500 tabular-nums">
                        Leads never matched{' '}
                        <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=never`}>
                          {b.leads.neverMatched} of {b.leads.total}
                        </Link>{' '}
                        · Matched &gt;7d / &gt;30d{' '}
                        <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older7d`}>
                          {b.leads.matchedOlderThan7d}
                        </Link>{' '}
                        /{' '}
                        <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older30d`}>
                          {b.leads.matchedOlderThan30d}
                        </Link>{' '}
                        · Duplicate keys {b.duplicateKeys} · Advisor refs unverified{' '}
                        {b.advisorReferencesNeverMatched} · Under review {b.correctionsUnderReview}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-hidden rounded-xl border border-dashed border-slate-200 md:block">
                  <Table responsive>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bank</TableHead>
                        <TableHead>Last upload / applied</TableHead>
                        <TableHead className="text-right">Imported</TableHead>
                        <TableHead className="text-right">Leads never matched</TableHead>
                        <TableHead className="text-right">Matched &gt;7d / &gt;30d</TableHead>
                        <TableHead className="text-right">Duplicate keys</TableHead>
                        <TableHead className="text-right">Advisor refs unverified</TableHead>
                        <TableHead className="text-right">Under review</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {idle.map((b) => (
                        <TableRow key={b.bank.id}>
                          <TableCell data-label="Bank">
                            <div className="flex items-center gap-2.5">
                              <BankMark code={b.bank.code} size="sm" />
                              <span className="font-medium text-slate-800">
                                {b.bank.displayName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell
                            data-label="Last upload / applied"
                            className="text-muted-foreground text-xs"
                          >
                            never / never
                          </TableCell>
                          <TableCell data-label="Imported" className="tabular-nums sm:text-right">
                            {b.rows.imported}
                          </TableCell>
                          <TableCell
                            data-label="Leads never matched"
                            className="tabular-nums sm:text-right"
                          >
                            <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=never`}>
                              {b.leads.neverMatched} of {b.leads.total}
                            </Link>
                          </TableCell>
                          <TableCell
                            data-label="Matched >7d / >30d"
                            className="tabular-nums sm:text-right"
                          >
                            <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older7d`}>
                              {b.leads.matchedOlderThan7d}
                            </Link>{' '}
                            /{' '}
                            <Link href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older30d`}>
                              {b.leads.matchedOlderThan30d}
                            </Link>
                          </TableCell>
                          <TableCell
                            data-label="Duplicate keys"
                            className="tabular-nums sm:text-right"
                          >
                            {b.duplicateKeys}
                          </TableCell>
                          <TableCell
                            data-label="Advisor refs unverified"
                            className="tabular-nums sm:text-right"
                          >
                            {b.advisorReferencesNeverMatched}
                          </TableCell>
                          <TableCell
                            data-label="Under review"
                            className="tabular-nums sm:text-right"
                          >
                            {b.correctionsUnderReview}
                          </TableCell>
                          <TableCell className="sm:text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/mis?bankId=${b.bank.id}`}>Batches</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
      {d.data.banks
        .filter((b) => b.newValuesPending.length)
        .map((b) => (
          <AcknowledgeValues
            key={b.bank.id}
            bank={b.bank}
            profileId={approvedProfile(b.bank.id)?.id ?? null}
            pending={b.newValuesPending}
          />
        ))}
      <Quarantine bankId={sp.bankId} />
    </div>
  );
}
