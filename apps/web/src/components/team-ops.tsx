import { type CallingQueueRow, formatDateTime, RECORD_STATUS_LABELS, type RecordStatus } from '@kbs/shared';
import { Filter, PhoneCall, Users } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { PlayRecordingButton } from '@/components/play-recording-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, MiniStat, SectionCard } from '@/components/ui/kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

/** F-808: badge tone per calling-record status (records page + caller drill-down). */
export const RECORD_STATUS_VARIANT: Record<RecordStatus, 'success' | 'info' | 'warning' | 'unknown' | 'secondary' | 'destructive'> = {
  NEEDS_REVIEW: 'warning',
  EXCLUDED: 'unknown',
  DO_NOT_CONTACT: 'destructive',
  UNASSIGNED: 'warning',
  UNTOUCHED: 'secondary',
  UNREACHABLE: 'warning',
  FOLLOW_UP: 'info',
  INTERESTED: 'success',
  LINK_SHARED: 'success',
  DECLINED: 'unknown',
  COMPLETED: 'secondary',
};

const fmtTalk = (sec: number) => `${Math.floor(sec / 3600) ? `${Math.floor(sec / 3600)}h ` : ''}${Math.round((sec % 3600) / 60)}m`;
const fmtCall = (sec: number | null) => (sec == null ? '—' : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}m ${sec % 60}s`);

export interface OverviewRow {
  id: string;
  fullName: string;
  employeeCode: string | null;
  status: string;
  training: string;
  wfhActive: boolean;
  lastLoginAt: string | null;
  queueSize: number;
  followUpsDue: number;
  attempts: number;
  connected: number;
  talkTimeSec: number;
  outcomes: Record<string, number>;
  shares: Record<string, number>;
  interests: number;
}

export function rangeParams(sp: { from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (sp.from) q.set('from', new Date(sp.from).toISOString());
  if (sp.to) q.set('to', new Date(sp.to).toISOString());
  return q.toString();
}

/** F-313 §1: team overview — evidence counts with denominators, no ranking. */
export async function TeamOverview({
  base,
  sp,
}: {
  base: string;
  sp: { from?: string; to?: string };
}) {
  const ov = await apiFetch<{ range: { from: string; to: string }; telecallers: OverviewRow[] }>(
    `/calling/team/overview?${rangeParams(sp)}`,
  );
  const rows = ov.data.telecallers;
  return (
    <SectionCard
      icon={Users}
      tone="violet"
      title="Team activity"
      description={`${formatDateTime(ov.data.range.from)} → ${formatDateTime(ov.data.range.to)} · attempts = call rows; connected = provider-confirmed only.`}
      actions={<RangeForm base={base} sp={sp} />}
      flush={rows.length > 0}
    >
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No Telecallers." />
      ) : (
        <TeamActivityTable rows={rows} base={base} sp={sp} />
      )}
    </SectionCard>
  );
}

/** F-313 / F-808 per-caller evidence table (reused by the Admin caller-performance page with an in-page scroll). */
export function TeamActivityTable({
  rows,
  base,
  sp,
  containerClassName,
  headerClassName,
}: {
  rows: OverviewRow[];
  base: string;
  sp: { from?: string; to?: string };
  containerClassName?: string;
  headerClassName?: string;
}) {
  return (
    <Table responsive containerClassName={containerClassName}>
      <TableHeader className={headerClassName}>
        <TableRow>
          <TableHead>Caller</TableHead>
          <TableHead>Assigned</TableHead>
          <TableHead>Attempted</TableHead>
          <TableHead>Connected</TableHead>
          <TableHead>Succeeded</TableHead>
          <TableHead>Talk time</TableHead>
          <TableHead className="sm:text-right">Success %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => (
          <TableRow key={t.id}>
            <TableCell data-label="Caller">
              <div className="flex min-w-40 items-start gap-2.5">
                <Avatar name={t.fullName} size="sm" />
                <div className="min-w-0">
                  <a className="font-medium" href={`${base}/telecaller/${t.id}?${rangeParams(sp)}`}>
                    {t.fullName}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant={t.status === 'ACTIVE' ? 'success' : 'unknown'}>{humanize(t.status)}</Badge>
                    {t.employeeCode ? <span className="font-mono text-[11px] text-slate-500">{t.employeeCode}</span> : null}
                    {t.training === 'PASSED' ? null : <Badge variant="warning">not trained</Badge>}
                    {t.wfhActive ? <Badge variant="info">WFH</Badge> : null}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell data-label="Assigned" className="tabular-nums">
              <span className="font-semibold text-slate-900">{t.queueSize}</span>
              {t.followUpsDue ? <div className="mt-0.5 text-[11px] font-medium text-rose-700">{t.followUpsDue} due</div> : null}
            </TableCell>
            <TableCell data-label="Attempted" className="tabular-nums">
              {t.attempts}
            </TableCell>
            <TableCell data-label="Connected" className="tabular-nums">
              {t.connected}
            </TableCell>
            <TableCell data-label="Succeeded" className="tabular-nums">
              {t.interests}
            </TableCell>
            <TableCell data-label="Talk time" className="text-xs whitespace-nowrap tabular-nums">
              {fmtTalk(t.talkTimeSec)}
            </TableCell>
            <TableCell data-label="Success %" className="font-semibold tabular-nums sm:text-right">
              {t.connected ? Math.round((t.interests / t.connected) * 100) : 0}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RangeForm({ base, sp }: { base: string; sp: { from?: string; to?: string } }) {
  const date = 'h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900';
  return (
    <Form action={base} className="flex flex-wrap items-end gap-2 text-xs">
      <label className="grid gap-1 font-medium text-slate-600">
        From
        <input type="date" name="from" defaultValue={sp.from?.slice(0, 10)} className={date} />
      </label>
      <label className="grid gap-1 font-medium text-slate-600">
        To
        <input type="date" name="to" defaultValue={sp.to?.slice(0, 10)} className={date} />
      </label>
      <Button type="submit" variant="outline" size="sm" className="h-9">
        <Filter />
        Apply
      </Button>
    </Form>
  );
}

/** F-808: Telecaller drill-down — one screen: caller identity, period tiles, assigned records with last-call info. */
export async function TelecallerActivity({
  id,
  base,
  sp,
  eyebrow,
}: {
  id: string;
  base: string;
  sp: { from?: string; to?: string };
  eyebrow?: string;
}) {
  const [ov, recs] = await Promise.all([
    apiFetch<{ telecallers: OverviewRow[] }>(`/calling/team/overview?${rangeParams(sp)}`),
    apiFetch<CallingQueueRow[]>(`/calling/records?telecallerId=${id}&status=ALL&pageSize=100`),
  ]);
  const t = ov.data.telecallers.find((x) => x.id === id);
  if (!t) return <EmptyState icon={Users} title="Caller not found in your scope." className="mt-8" />;
  const records = recs.data;
  const total = Number(recs.meta.total ?? records.length);
  const pct = t.attempts ? Math.round((t.connected / t.attempts) * 100) : 0;
  const rate = t.connected ? Math.round((t.interests / t.connected) * 100) : 0;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={t.fullName} size="lg" />
          <div className="min-w-0">
            {eyebrow ? <div className="text-[10.5px] font-semibold tracking-[0.16em] text-violet-700 uppercase">{eyebrow}</div> : null}
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">{t.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge variant={t.status === 'ACTIVE' ? 'success' : 'unknown'}>{humanize(t.status)}</Badge>
              {t.employeeCode ? <span className="font-mono">{t.employeeCode}</span> : null}
              {t.training === 'PASSED' ? null : <Badge variant="warning">not trained</Badge>}
              <Link href={base} className="text-sky-700 hover:underline">All callers</Link>
            </div>
          </div>
        </div>
        <RangeForm base={`${base}/telecaller/${id}`} sp={sp} />
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Assigned" value={t.queueSize} hint={`${t.followUpsDue} follow-ups due`} tone="violet" />
        <MiniStat label="Attempted" value={t.attempts} hint="Calls in the period" tone="sky" />
        <MiniStat label="Connected" value={t.connected} hint={`${pct}% of attempts`} tone="emerald" />
        <MiniStat label="Succeeded" value={t.interests} hint="Marked interested" tone="teal" />
        <MiniStat label="Talk time" value={fmtTalk(t.talkTimeSec)} hint="Connected calls" tone="indigo" />
        <MiniStat label="Success rate" value={`${rate}%`} hint="Of connected calls" tone="amber" />
      </div>
      <section aria-label="Assigned records" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Assigned records</span>
          <span className="tabular-nums">{total}</span>
        </div>
        <div className="min-h-0 flex-1">
          {records.length === 0 ? (
            <EmptyState icon={PhoneCall} title="No records assigned to this caller." className="m-3" />
          ) : (
            <Table responsive containerClassName="lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Current status</TableHead>
                  <TableHead>Last call</TableHead>
                  <TableHead>Recording</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell data-label="Customer">
                      <div className="font-medium text-slate-900">{r.fullName}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">
                        {r.mobileMasked} · {r.pincode}
                      </div>
                    </TableCell>
                    <TableCell data-label="Current status">
                      <Badge variant={RECORD_STATUS_VARIANT[r.recordStatus]}>{RECORD_STATUS_LABELS[r.recordStatus]}</Badge>
                      {r.nextFollowUpAt ? <div className="mt-1 text-[11px] font-medium text-sky-800">Follow-up {formatDateTime(r.nextFollowUpAt)}</div> : null}
                    </TableCell>
                    <TableCell data-label="Last call" className="text-xs tabular-nums">
                      {r.lastCall ? (
                        <>
                          <div className="font-medium text-slate-800">{fmtCall(r.lastCall.durationSec)}</div>
                          <div className="mt-0.5 text-slate-500">{formatDateTime(r.lastCall.at)}</div>
                        </>
                      ) : (
                        <span className="text-slate-500">No call yet</span>
                      )}
                    </TableCell>
                    <TableCell data-label="Recording">
                      {r.lastCall ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant={r.lastCall.recordingStatus === 'AVAILABLE' ? 'success' : r.lastCall.recordingStatus === 'FAILED' ? 'destructive' : 'unknown'}>
                            {r.lastCall.recordingStatus ? humanize(r.lastCall.recordingStatus) : 'None'}
                          </Badge>
                          {r.lastCall.canPlay ? <PlayRecordingButton callId={r.lastCall.id} /> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
