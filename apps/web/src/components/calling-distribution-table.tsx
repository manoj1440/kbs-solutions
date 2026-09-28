'use client';

import { type CallingQueueRow, type CallOutcome, formatDateTime, OUTCOME_LABELS } from '@kbs/shared';
import { CalendarClock, Inbox } from 'lucide-react';

import { columnHelper, DataTable } from '@/components/data-table';
import { ReassignForm } from '@/components/reassign-form';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

const INTERACTION_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'unknown' | 'secondary'> = {
  UNTOUCHED: 'secondary',
  FOLLOW_UP: 'info',
  INTERESTED: 'success',
  LINK_SHARED: 'success',
  COMPLETED: 'success',
  DECLINED: 'unknown',
  UNREACHABLE: 'warning',
};

const c = columnHelper<CallingQueueRow>();

/** F-305 §6 / F-307 §4 records tab: scoped records with reassignment. Mobiles masked (REQ-08 §8.3). */
export function DistributionRecordsTable({
  rows,
  eligible,
}: {
  rows: CallingQueueRow[];
  eligible: { id: string; label: string }[];
}) {
  const columns = c.columns([
    c.accessor('fullName', {
      header: 'Customer / mobile',
      cell: ({ row }) => (
        <>
          <div className="font-medium text-slate-900">{row.original.fullName}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">{row.original.mobileMasked}</div>
        </>
      ),
    }),
    c.accessor('pincode', {
      header: 'Location',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <div className="font-mono">{row.original.pincode}</div>
          <div className="mt-0.5 text-slate-500">{row.original.location}</div>
        </>
      ),
    }),
    c.accessor('interactionStatus', {
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={INTERACTION_VARIANT[row.original.interactionStatus] ?? 'secondary'}>{humanize(row.original.interactionStatus)}</Badge>
          {row.original.suppressed ? <Badge variant="destructive">DNC</Badge> : null}
        </div>
      ),
    }),
    c.accessor((r) => r.assignedTelecaller?.fullName ?? '', {
      id: 'assignedTo',
      header: 'Assigned to',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) =>
        row.original.assignedTelecaller ? (
          <span className="inline-flex items-center gap-2">
            <Avatar name={row.original.assignedTelecaller.fullName} size="sm" />
            <span className="font-medium text-slate-800">{row.original.assignedTelecaller.fullName}</span>
          </span>
        ) : (
          <em className="text-slate-500">unassigned</em>
        ),
    }),
    c.display({
      id: 'followUp',
      header: 'Follow-up / last outcome',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <>
            <div className={cn('inline-flex items-center gap-1', r.nextFollowUpAt ? 'font-medium text-slate-800' : 'text-slate-500')}>
              {r.nextFollowUpAt ? <CalendarClock className="size-3.5 text-sky-600" aria-hidden="true" /> : null}
              {r.nextFollowUpAt ? `Due ${formatDateTime(r.nextFollowUpAt)}` : 'No follow-up scheduled'}
            </div>
            <div className="mt-1 text-slate-500">
              {r.lastOutcome ? (
                <>
                  <Badge variant="outline" title={r.lastOutcome.outcome} className="whitespace-normal">
                    {OUTCOME_LABELS[r.lastOutcome.outcome as CallOutcome] ?? r.lastOutcome.outcome}
                  </Badge>
                  {r.lastOutcome.remarks ? <span className="ml-1">— {r.lastOutcome.remarks}</span> : null}
                </>
              ) : (
                'No outcome recorded'
              )}
            </div>
          </>
        );
      },
    }),
    c.display({
      id: 'reassign',
      header: 'Reassign',
      cell: ({ row }) =>
        row.original.hiddenAt ? null : (
          <ReassignForm recordId={row.original.id} currentId={row.original.assignedTelecaller?.id ?? null} options={eligible} />
        ),
    }),
  ]);
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={<EmptyState icon={Inbox} title="No records." description="Nothing in this tab for the current selection." />}
    />
  );
}
