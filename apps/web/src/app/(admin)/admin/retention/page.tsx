import { formatDateTime } from '@kbs/shared';
import {
  FileX2,
  Gavel,
  OctagonAlert,
  ShieldCheck,
  UserRoundX,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Callout,
  EmptyState,
  IconTile,
  MiniStat,
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

import { LegalHoldForm, RunRetention } from './actions';

export const metadata = { title: 'Retention · KBS Solutions' };

interface CategoryPlan {
  category: string;
  label: string;
  configKey: string;
  action: 'PURGE_FILE' | 'RESTRICT_RECORD';
  days: number | null;
  configured: boolean;
  cutoff: string | null;
  olderThanCutoff: number | null;
  onHold: number | null;
  protected: number | null;
  eligible: number | null;
  onHoldTotal: number;
  alreadyDone: number;
  runnable: boolean;
  blockedReason: string | null;
}
interface Plan {
  executionEnabled: boolean;
  scheduleEnabled: boolean;
  neverRemoved: string[];
  categories: CategoryPlan[];
}
interface Hold {
  subject: string;
  id: string;
  label: string;
  reason: string | null;
  createdAt: string;
  restricted?: boolean;
}

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-IN'));

/** F-904 → F-811 Admin: retention dry run, fail-closed execution and legal holds (REQ-21 §21.5). */
export default async function RetentionPage() {
  const [{ data: plan }, { data: holds }] = await Promise.all([
    apiFetch<Plan>('/retention/plan'),
    apiFetch<{ files: Hold[]; records: Hold[] }>('/retention/legal-holds'),
  ]);
  const allHolds = [...holds.files, ...holds.records];
  const unset = plan.categories.filter((c) => !c.configured);
  const blocked = unset.length > 0 || !plan.executionEnabled;
  const nightly = plan.scheduleEnabled && plan.executionEnabled;
  const configured = plan.categories.length - unset.length;
  const counted = plan.categories.filter((c) => c.eligible !== null);
  const eligible = counted.reduce((sum, c) => sum + (c.eligible ?? 0), 0);
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Data retention &amp; legal hold</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Retention runs" value={blocked ? 'Blocked' : 'Ready'} hint={`execution ${plan.executionEnabled ? 'on' : 'off'} · nightly ${nightly ? 'on' : 'off'}`} tone={blocked ? 'rose' : 'emerald'} />
        <MiniStat label="Durations set" value={`${configured} / ${plan.categories.length}`} hint={unset.length ? 'Awaiting KBS approval' : 'Every category has a duration'} tone={unset.length ? 'amber' : 'emerald'} />
        <MiniStat label="Eligible now" value={counted.length ? n(eligible) : '—'} hint={counted.length ? 'Dry run across configured categories' : 'No durations set'} tone="sky" />
        <MiniStat label="Legal holds" value={n(allHolds.length)} hint="Skipped by every run" tone="violet" />
      </div>
      {blocked ? (
        <Callout tone="warning" icon={OctagonAlert} role="status" title={<span className="inline-flex flex-wrap items-center gap-2"><Badge variant="warning">Blocked</Badge> Retention is not running</span>} className="shrink-0">
          <p>
            KBS has not approved retention durations yet (REQ-21 §21.5 OPEN). Nothing is purged or restricted until each duration is set and <span className="font-mono">retention.executionEnabled</span> is on in <Link className="font-medium underline underline-offset-2" href="/admin/config">Configuration</Link>.
          </p>
          {unset.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span>Missing:</span>
              {unset.map((c) => (
                <code key={c.configKey} className="rounded-md bg-white px-2 py-0.5 font-mono text-xs break-all text-amber-900 ring-1 ring-amber-200">
                  {c.configKey}
                </code>
              ))}
            </div>
          ) : null}
        </Callout>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:overflow-visible">
        <section aria-label="Dry run" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Dry run — counts are live and change nothing · nightly 02:00 IST <Badge variant={nightly ? 'success' : 'unknown'}>{nightly ? 'on' : 'off'}</Badge>
          </div>
          <div className="min-h-0 flex-1">
            <Table responsive="compact" containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Category</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead className="text-right">Past cutoff</TableHead>
                  <TableHead className="text-right">Hold</TableHead>
                  <TableHead className="text-right">Protected</TableHead>
                  <TableHead className="text-right">Eligible</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.categories.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell className="pl-4" data-label="Category">
                      <div className="flex items-center gap-2.5">
                        <IconTile icon={c.action === 'PURGE_FILE' ? FileX2 : UserRoundX} tone={c.action === 'PURGE_FILE' ? 'rose' : 'violet'} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800">{c.label}</div>
                          <div className="text-xs text-slate-500">{c.action === 'PURGE_FILE' ? 'Purge file' : 'Restrict record'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-label="Retention" className="text-xs">
                      {c.configured ? (
                        <>
                          <span className="font-medium text-slate-800 tabular-nums">{c.days} days</span>
                          <div className="text-slate-500">before {c.cutoff ? formatDateTime(c.cutoff) : ''}</div>
                        </>
                      ) : (
                        <Badge variant="unknown" className="whitespace-nowrap">not set</Badge>
                      )}
                    </TableCell>
                    <TableCell data-label="Past cutoff" className="tabular-nums sm:text-right">{n(c.olderThanCutoff)}</TableCell>
                    <TableCell data-label="Legal hold" className="tabular-nums sm:text-right">{n(c.onHold)}</TableCell>
                    <TableCell data-label="Protected" className="tabular-nums sm:text-right">{n(c.protected)}</TableCell>
                    <TableCell data-label="Eligible" className="font-semibold text-slate-900 tabular-nums sm:text-right">{n(c.eligible)}</TableCell>
                    <TableCell data-label="Done" className="tabular-nums sm:text-right">{n(c.alreadyDone)}</TableCell>
                    <TableCell className="pr-4 sm:text-right">
                      <RunRetention category={c.category} label={c.label} runnable={c.configured && c.runnable} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p>Never removed: {plan.neverRemoved.join(' · ')}.</p>
          </div>
        </section>
        <section aria-label="Legal holds" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 p-3">
            <LegalHoldForm />
          </div>
          <div className="min-h-0 flex-1">
            {allHolds.length ? (
              <Table responsive="compact" containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="pl-4">Item</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="pr-4">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allHolds.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="pl-4" data-label="Item">
                        <div className="font-medium text-slate-800">{h.label}</div>
                        <div className="font-mono text-[11px] break-all text-slate-500">{h.id}</div>
                      </TableCell>
                      <TableCell data-label="Reason" className="text-xs text-slate-600">{h.reason}</TableCell>
                      <TableCell className="pr-4 text-xs text-slate-600" data-label="Created">{formatDateTime(h.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState className="m-3 py-7" icon={Gavel} title="No items are on legal hold." description="Place a hold above by file or calling-record id to exclude it from every retention run." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
