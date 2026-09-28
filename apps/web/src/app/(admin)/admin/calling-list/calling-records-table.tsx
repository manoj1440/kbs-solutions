'use client';

import { type CallingQueueRow, type CallOutcome, formatDateTime, OUTCOME_LABELS, RECORD_STATUS_LABELS } from '@kbs/shared';
import { CalendarClock, Inbox, UserX } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { ReassignForm } from '@/components/reassign-form';
import { RECORD_STATUS_VARIANT } from '@/lib/calling-shared';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize } from '@/components/ui/kit';

const c = columnHelper<CallingQueueRow>();
const callerHref = (id: string) => `/admin/calling-list/performance/telecaller/${id}`;

export function CallingRecordsTable({
  rows,
  filtered,
  eligible,
}: {
  rows: CallingQueueRow[];
  filtered: boolean;
  eligible: { id: string; label: string }[];
}) {
  const columns = c.columns([
    c.accessor('fullName', {
      header: 'Customer',
      cell: ({ row }) => (
        <>
          <div className="font-medium text-slate-900">{row.original.fullName}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">{row.original.mobileMasked}</div>
        </>
      ),
    }),
    c.accessor('pincode', {
      header: 'Pincode / location',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <div className="font-mono">{row.original.pincode}</div>
          <div className="mt-0.5 text-slate-500">{row.original.location}</div>
        </>
      ),
    }),
    c.accessor('recordStatus', {
      header: 'Current status',
      cell: ({ getValue }) => <Badge variant={RECORD_STATUS_VARIANT[getValue()]}>{RECORD_STATUS_LABELS[getValue()]}</Badge>,
    }),
    c.accessor((r) => r.assignedTelecaller?.fullName ?? '', {
      id: 'caller',
      header: 'Caller',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) =>
        row.original.assignedTelecaller ? (
          <Link href={callerHref(row.original.assignedTelecaller.id)} className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-teal-700">
            <Avatar name={row.original.assignedTelecaller.fullName} size="sm" />
            {row.original.assignedTelecaller.fullName}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <UserX className="size-3.5" aria-hidden="true" />
            No caller
          </span>
        ),
    }),
    c.accessor((r) => r.lastOutcome?.at ?? '', {
      id: 'lastActivity',
      header: 'Last activity',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          {row.original.lastOutcome ? (
            <>
              <div className="font-medium text-slate-800">{OUTCOME_LABELS[row.original.lastOutcome.outcome as CallOutcome] ?? humanize(row.original.lastOutcome.outcome)}</div>
              <div className="mt-0.5 text-slate-500">
                {formatDateTime(row.original.lastOutcome.at)}
                {row.original.lastOutcome.remarks ? ` — ${row.original.lastOutcome.remarks}` : ''}
              </div>
            </>
          ) : (
            <span className="text-slate-500">No outcome yet</span>
          )}
          {row.original.nextFollowUpAt ? (
            <div className="mt-1 inline-flex items-center gap-1 font-medium text-sky-800">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Follow-up {formatDateTime(row.original.nextFollowUpAt)}
            </div>
          ) : null}
        </>
      ),
    }),
    c.display({
      id: 'action',
      header: 'Actions',
      cell: ({ row }) =>
        row.original.recordStatus === 'NEEDS_REVIEW' ? (
          <Link href={`/admin/calling-list/${row.original.batchId}`} className="text-[13px] font-medium text-teal-700 hover:underline">
            Review in {row.original.batchRef}
          </Link>
        ) : row.original.recordStatus === 'EXCLUDED' || row.original.recordStatus === 'DO_NOT_CONTACT' || row.original.hiddenAt ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <ReassignForm recordId={row.original.id} currentId={row.original.assignedTelecaller?.id ?? null} options={eligible} />
        ),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      pagedOnServer
      empty={
        <EmptyState
          icon={Inbox}
          className="m-3"
          title={filtered ? 'No records match these filters.' : 'No customer records yet.'}
          description={filtered ? 'Change or reset the filters.' : 'Upload a customer list to begin.'}
        />
      }
    />
  );
}
