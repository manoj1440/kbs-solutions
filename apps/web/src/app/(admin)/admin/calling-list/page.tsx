import {
  type CallingQueueRow,
  type CallingRecordsSummary,
  type CallOutcome,
  formatDateTime,
  OUTCOME_LABELS,
  RECORD_STATUS_LABELS,
  RECORD_STATUSES,
  type RecordStatus,
} from '@kbs/shared';
import { CalendarClock, ChevronLeft, ChevronRight, Filter, Inbox, TriangleAlert, UserX } from 'lucide-react';
import Link from 'next/link';

import { ReassignForm } from '@/components/reassign-form';
import { RECORD_STATUS_VARIANT } from '@/components/team-ops';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, MiniStat, selectClass } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { UploadListButton } from './new-batch';

export const metadata = { title: 'Calling records · KBS Solutions' };

const PAGE_SIZE = 100;

interface BatchRow {
  id: string;
  publicRef: string;
  status: string;
  file: string;
  uploader: string;
  uploadedAt: string;
  totals: { rows?: number; imported?: number; needsReview?: number; excluded?: number } | null;
  allocatedAt: string | null;
  attested: boolean;
}
interface Caller {
  id: string;
  fullName: string;
  eligible: boolean;
}

const WORKED: RecordStatus[] = ['UNREACHABLE', 'FOLLOW_UP', 'INTERESTED', 'LINK_SHARED', 'DECLINED', 'COMPLETED'];

/** What the Admin still has to do with a batch (mapping, review, consent, allocation) — null when nothing. */
function batchAction(b: BatchRow) {
  if (b.status === 'UPLOADED') return 'Map columns';
  if (b.status === 'VALIDATED') return 'Confirm import';
  if (b.status === 'IMPORTED' && !b.allocatedAt) return b.attested ? 'Allocate to callers' : 'Confirm consent to allocate';
  return null;
}

/**
 * F-808 Calling records: upload, what is in the system, and every record (100 per page) with status / name /
 * pincode / caller filters. One status per row (`recordStatusOf`), so the tiles, the filter and the table agree.
 * Mobiles stay masked (REQ-08 §8.3); no status here is a bank result (INV-05).
 */
export default async function CallingRecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = (RECORD_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as RecordStatus) : 'ALL';
  const pincode = /^\d{1,6}$/.test(sp.pincode ?? '') ? sp.pincode : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const qs = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.q?.trim()) qs.set('search', sp.q.trim());
  if (pincode) qs.set('pincode', pincode);
  if (sp.telecallerId) qs.set('telecallerId', sp.telecallerId);
  const [summary, records, batches, dist] = await Promise.all([
    apiFetch<CallingRecordsSummary>('/calling/records/summary').then((r) => r.data),
    apiFetch<CallingQueueRow[]>(`/calling/records?${qs.toString()}`),
    apiFetch<BatchRow[]>('/calling-list/batches?pageSize=50'),
    apiFetch<{ telecallers: Caller[] }>('/calling/distribution').then((r) => r.data.telecallers),
  ]);
  const by = summary.byStatus;
  const sum = (keys: RecordStatus[]) => keys.reduce((n, k) => n + by[k], 0);
  const pct = (n: number) => (summary.total ? `${Math.round((n / summary.total) * 100)}%` : '0%');
  const worked = sum(WORKED);
  const positive = sum(['INTERESTED', 'LINK_SHARED']);
  const closed = sum(['DECLINED', 'COMPLETED', 'DO_NOT_CONTACT', 'EXCLUDED']);
  const total = Number(records.meta.total ?? records.data.length);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pending = batches.data.filter((b) => batchAction(b));
  const eligible = dist.filter((t) => t.eligible).map((t) => ({ id: t.id, label: t.fullName }));
  const filtered = status !== 'ALL' || sp.q || pincode || sp.telecallerId;
  const link = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: status === 'ALL' ? undefined : status, q: sp.q, pincode, telecallerId: sp.telecallerId, ...over })) if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/calling-list${s ? `?${s}` : ''}`;
  };
  const statusHref = (s: RecordStatus | 'ALL') => link({ status: s === 'ALL' ? undefined : s, page: undefined });

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Calling records</h1>
      {pending.length || by.NEEDS_REVIEW ? (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <TriangleAlert className="size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          {pending.map((b) => (
            <Link key={b.id} href={`/admin/calling-list/${b.id}`} className="font-medium underline-offset-2 hover:underline">
              <span className="font-mono">{b.publicRef}</span> → {batchAction(b)}
            </Link>
          ))}
          {by.NEEDS_REVIEW ? (
            <Link href={statusHref('NEEDS_REVIEW')} className="font-medium underline-offset-2 hover:underline">
              {by.NEEDS_REVIEW} row{by.NEEDS_REVIEW === 1 ? '' : 's'} need import review
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <MiniStat label="Customer records" value={summary.total.toLocaleString('en-IN')} hint={`${summary.batches.total} upload${summary.batches.total === 1 ? '' : 's'}`} tone="sky" />
        <MiniStat label="Waiting for a caller" value={by.UNASSIGNED} hint="Accepted, not assigned" tone="amber" />
        <MiniStat label="Not yet called" value={by.UNTOUCHED} hint={`Assigned, no outcome · ${pct(by.UNTOUCHED)}`} tone="violet" />
        <MiniStat label="Called at least once" value={summary.attempted} hint={`${summary.connected} connected (provider)`} tone="indigo" />
        <MiniStat label="Outcome recorded" value={worked} hint={`${by.UNREACHABLE} not reachable · ${by.FOLLOW_UP} follow-up`} tone="teal" />
        <MiniStat label="Interested / link shared" value={positive} hint={`${by.INTERESTED} interested · ${by.LINK_SHARED} shared`} tone="emerald" />
        <MiniStat label="Follow-ups due now" value={summary.followUpsDue} hint={`${by.FOLLOW_UP} scheduled`} tone="amber" />
        <MiniStat label="Closed or blocked" value={closed} hint={`${by.DECLINED + by.COMPLETED} closed · ${by.DO_NOT_CONTACT + by.EXCLUDED} blocked`} tone="slate" />
      </div>

      <section id="records" aria-label="Calling records" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <form action="/admin/calling-list" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input aria-label="Customer name" name="q" className={cn(selectClass, 'h-9 min-w-40 flex-[2_1_10rem]')} defaultValue={sp.q ?? ''} placeholder="Search customer name" />
            <input aria-label="Pincode" name="pincode" className={cn(selectClass, 'h-9 w-28 flex-none')} inputMode="numeric" maxLength={6} pattern="\d{1,6}" defaultValue={pincode ?? ''} placeholder="Pincode" />
            <select aria-label="Current status" name="status" className={cn(selectClass, 'h-9 min-w-44 flex-[1_1_11rem]')} defaultValue={status === 'ALL' ? '' : status}>
              <option value="">All statuses ({summary.total})</option>
              {RECORD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RECORD_STATUS_LABELS[s]} ({by[s]})
                </option>
              ))}
            </select>
            <select aria-label="Caller" name="telecallerId" className={cn(selectClass, 'h-9 min-w-36 flex-[1_1_9rem]')} defaultValue={sp.telecallerId ?? ''}>
              <option value="">All callers</option>
              {dist.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" className="h-9">
              <Filter />
              Apply
            </Button>
            {filtered ? (
              <Button asChild size="sm" variant="ghost" className="h-9">
                <Link href="/admin/calling-list">Reset</Link>
              </Button>
            ) : null}
          </form>
          <UploadListButton />
        </div>
        <div className="min-h-0 flex-1">
          {records.data.length === 0 ? (
            <EmptyState icon={Inbox} className="m-3" title={filtered ? 'No records match these filters.' : 'No customer records yet.'} description={filtered ? 'Change or reset the filters.' : 'Upload a customer list to begin.'} />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead>Pincode / location</TableHead>
                  <TableHead>Current status</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4" data-label="Customer">
                      <div className="font-medium text-slate-900">{r.fullName}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">{r.mobileMasked}</div>
                    </TableCell>
                    <TableCell data-label="Pincode / location" className="text-xs">
                      <div className="font-mono">{r.pincode}</div>
                      <div className="mt-0.5 text-slate-500">{r.location}</div>
                    </TableCell>
                    <TableCell data-label="Current status">
                      <Badge variant={RECORD_STATUS_VARIANT[r.recordStatus]}>{RECORD_STATUS_LABELS[r.recordStatus]}</Badge>
                    </TableCell>
                    <TableCell data-label="Caller" className="text-xs">
                      {r.assignedTelecaller ? (
                        <Link href={`/admin/calling-list/performance/telecaller/${r.assignedTelecaller.id}`} className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-teal-700">
                          <Avatar name={r.assignedTelecaller.fullName} size="sm" />
                          {r.assignedTelecaller.fullName}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <UserX className="size-3.5" aria-hidden="true" />
                          No caller
                        </span>
                      )}
                    </TableCell>
                    <TableCell data-label="Last activity" className="text-xs">
                      {r.lastOutcome ? (
                        <>
                          <div className="font-medium text-slate-800">{OUTCOME_LABELS[r.lastOutcome.outcome as CallOutcome] ?? humanize(r.lastOutcome.outcome)}</div>
                          <div className="mt-0.5 text-slate-500">
                            {formatDateTime(r.lastOutcome.at)}
                            {r.lastOutcome.remarks ? ` — ${r.lastOutcome.remarks}` : ''}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">No outcome yet</span>
                      )}
                      {r.nextFollowUpAt ? (
                        <div className="mt-1 inline-flex items-center gap-1 font-medium text-sky-800">
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                          Follow-up {formatDateTime(r.nextFollowUpAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="pr-4" data-label="Action">
                      {r.recordStatus === 'NEEDS_REVIEW' ? (
                        <Link href={`/admin/calling-list/${r.batchId}`} className="text-[13px] font-medium text-teal-700 hover:underline">
                          Review in {r.batchRef}
                        </Link>
                      ) : r.recordStatus === 'EXCLUDED' || r.recordStatus === 'DO_NOT_CONTACT' || r.hiddenAt ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <ReassignForm recordId={r.id} currentId={r.assignedTelecaller?.id ?? null} options={eligible} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-500 tabular-nums">
            {total ? `${((page - 1) * PAGE_SIZE + 1).toLocaleString('en-IN')}–${Math.min(page * PAGE_SIZE, total).toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}` : '0 records'} · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page - 1) })}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page + 1) })}>
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
