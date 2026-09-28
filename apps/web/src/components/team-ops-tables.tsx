'use client';

import { type CallingQueueRow, formatDateTime, RECORD_STATUS_LABELS } from '@kbs/shared';
import { PhoneCall } from 'lucide-react';

import { columnHelper, DataTable } from '@/components/data-table';
import { PlayRecordingButton } from '@/components/play-recording-button';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize } from '@/components/ui/kit';
import { fmtCall, fmtTalk, type OverviewRow, rangeParams, RECORD_STATUS_VARIANT } from '@/lib/calling-shared';

const c = columnHelper<OverviewRow>();

/** F-313 / F-808 per-caller evidence table (reused by the Admin caller-performance page). */
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
  const qs = rangeParams(sp);
  const columns = c.columns([
    c.accessor('fullName', {
      id: 'caller',
      header: 'Caller',
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex min-w-40 items-start gap-2.5">
            <Avatar name={t.fullName} size="sm" />
            <div className="min-w-0">
              <a className="font-medium" href={`${base}/telecaller/${t.id}?${qs}`}>
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
        );
      },
    }),
    c.accessor('queueSize', {
      header: 'Assigned',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <>
          <span className="font-semibold text-slate-900">{row.original.queueSize}</span>
          {row.original.followUpsDue ? <div className="mt-0.5 text-[11px] font-medium text-rose-700">{row.original.followUpsDue} due</div> : null}
        </>
      ),
    }),
    c.accessor('attempts', { header: 'Attempted', meta: { align: 'right' } }),
    c.accessor('connected', { header: 'Connected', meta: { align: 'right' } }),
    c.accessor('interests', { header: 'Succeeded', meta: { align: 'right' } }),
    c.accessor('talkTimeSec', {
      header: 'Talk time',
      meta: { align: 'right' },
      cell: ({ getValue }) => <span className="text-xs whitespace-nowrap">{fmtTalk(getValue())}</span>,
    }),
    c.accessor((r) => (r.connected ? Math.round((r.interests / r.connected) * 100) : 0), {
      id: 'success',
      header: 'Success %',
      meta: { align: 'right' },
      cell: ({ getValue }) => <span className="font-semibold">{getValue()}%</span>,
    }),
  ]);
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} containerClassName={containerClassName} headerClassName={headerClassName} />;
}

const q = columnHelper<CallingQueueRow>();

/** F-808 TelecallerActivity records table: assigned records with last-call info. */
export function AssignedRecordsTable({ rows }: { rows: CallingQueueRow[] }) {
  const columns = q.columns([
    q.accessor('fullName', {
      header: 'Customer',
      cell: ({ row }) => (
        <>
          <div className="font-medium text-slate-900">{row.original.fullName}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">
            {row.original.mobileMasked} · {row.original.pincode}
          </div>
        </>
      ),
    }),
    q.accessor('recordStatus', {
      header: 'Current status',
      cell: ({ row }) => (
        <>
          <Badge variant={RECORD_STATUS_VARIANT[row.original.recordStatus]}>{RECORD_STATUS_LABELS[row.original.recordStatus]}</Badge>
          {row.original.nextFollowUpAt ? <div className="mt-1 text-[11px] font-medium text-sky-800">Follow-up {formatDateTime(row.original.nextFollowUpAt)}</div> : null}
        </>
      ),
    }),
    q.accessor((r) => r.lastCall?.at ?? '', {
      id: 'lastCall',
      header: 'Last call',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs tabular-nums' },
      cell: ({ row }) =>
        row.original.lastCall ? (
          <>
            <div className="font-medium text-slate-800">{fmtCall(row.original.lastCall.durationSec)}</div>
            <div className="mt-0.5 text-slate-500">{formatDateTime(row.original.lastCall.at)}</div>
          </>
        ) : (
          <span className="text-slate-500">No call yet</span>
        ),
    }),
    q.display({
      id: 'recording',
      header: 'Recording',
      cell: ({ row }) =>
        row.original.lastCall ? (
          <div className="flex items-center gap-1.5">
            <Badge variant={row.original.lastCall.recordingStatus === 'AVAILABLE' ? 'success' : row.original.lastCall.recordingStatus === 'FAILED' ? 'destructive' : 'unknown'}>
              {row.original.lastCall.recordingStatus ? humanize(row.original.lastCall.recordingStatus) : 'None'}
            </Badge>
            {row.original.lastCall.canPlay ? <PlayRecordingButton callId={row.original.lastCall.id} /> : null}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    }),
  ]);
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      variant="panel"
      empty={<EmptyState icon={PhoneCall} title="No records assigned to this caller." className="m-3" />}
    />
  );
}
