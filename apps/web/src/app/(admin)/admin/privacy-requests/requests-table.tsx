'use client';

import { DATA_REQUEST_STATUS_LABEL, DATA_REQUEST_TYPE_LABEL, type DataRequestAdminView, type DataRequestStatus } from '@kbs/shared';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable, DateCell, Dash, PersonCell } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/kit';

/** Status → badge variant; the label text always carries the meaning (REQ-20 §20.2). */
export const REQUEST_STATUS_VARIANT: Record<DataRequestStatus, 'info' | 'warning' | 'success' | 'secondary'> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  REJECTED: 'secondary',
};

const c = columnHelper<DataRequestAdminView>();
const columns = c.columns([
  c.accessor('publicRef', {
    header: 'Request',
    cell: ({ row }) => (
      <>
        <Link className="font-mono text-xs font-semibold" href={`/admin/privacy-requests/${row.original.id}`}>
          {row.original.publicRef}
        </Link>
        <div className="mt-0.5 text-xs text-fg-2">{DATA_REQUEST_TYPE_LABEL[row.original.type]}</div>
      </>
    ),
  }),
  c.accessor((r) => r.requester.fullName, {
    id: 'requester',
    header: 'From',
    cell: ({ row }) => <PersonCell name={row.original.requester.fullName || row.original.requester.publicRef} status={row.original.requester.role} code={row.original.requester.publicRef} />,
  }),
  c.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <Badge variant={REQUEST_STATUS_VARIANT[getValue()]}>{DATA_REQUEST_STATUS_LABEL[getValue()]}</Badge>,
  }),
  c.accessor('dueAt', {
    header: 'Reply by',
    cell: ({ row }) =>
      row.original.closedAt ? (
        <span className="text-xs text-muted-foreground">Closed</span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <DateCell value={row.original.dueAt} />
          {row.original.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
        </span>
      ),
  }),
  c.accessor((r) => r.handledBy?.fullName ?? '', {
    id: 'handledBy',
    header: 'Handled by',
    cell: ({ row }) => (row.original.handledBy ? <span className="text-xs text-fg-2">{row.original.handledBy.fullName}</span> : <Dash />),
  }),
  c.accessor('createdAt', { header: 'Received', cell: ({ getValue }) => <DateCell value={getValue()} /> }),
]);

export function RequestsTable({ rows, filtered }: { rows: DataRequestAdminView[]; filtered: boolean }) {
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      pagedOnServer
      empty={
        <EmptyState
          icon={ShieldCheck}
          className="m-3"
          title={filtered ? 'No requests match these filters.' : 'No data requests yet.'}
          description="Requests filed from the app or the web account page appear here, oldest deadline first."
        />
      }
    />
  );
}
