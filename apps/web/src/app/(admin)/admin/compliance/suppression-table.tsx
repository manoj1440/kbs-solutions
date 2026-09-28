'use client';

import { formatDateTime } from '@kbs/shared';
import { ShieldCheck } from 'lucide-react';

import { columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, humanize } from '@/components/ui/kit';

import { LiftButton } from './actions';

export interface Suppression {
  id: string;
  mobile: string;
  reason: string;
  at: string;
  liftedAt: string | null;
  createdByUserId: string | null;
}

const REASON: Record<string, string> = {
  CUSTOMER_REQUEST: 'Customer request',
  COMPLIANCE: 'Compliance',
  DND_LIST: 'DND list',
};

const c = columnHelper<Suppression>();
const columns = c.columns([
  c.accessor('mobile', {
    header: 'Mobile',
    meta: { cellClassName: 'font-mono text-xs text-slate-800' },
  }),
  c.accessor('reason', {
    header: 'Reason',
    cell: ({ getValue }) => <Badge variant="secondary">{REASON[getValue()] ?? humanize(getValue())}</Badge>,
  }),
  c.accessor('at', {
    header: 'Added',
    sortFn: 'datetime',
    meta: { cellClassName: 'text-xs text-slate-600' },
    cell: ({ getValue }) => formatDateTime(getValue()),
  }),
  c.accessor('liftedAt', {
    header: 'Status',
    cell: ({ getValue }) =>
      getValue() ? <Badge variant="unknown">lifted {formatDateTime(getValue())}</Badge> : <Badge variant="destructive">active</Badge>,
  }),
  c.display({
    id: 'actions',
    header: 'Actions',
    meta: { hideLabel: true },
    cell: ({ row }) => (row.original.liftedAt ? null : <LiftButton id={row.original.id} />),
  }),
]);

export function SuppressionTable({ rows }: { rows: Suppression[] }) {
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={
        <EmptyState icon={ShieldCheck} className="m-3" title="No suppressed mobiles" description="Suppress a mobile above or import a DND list. Suppressed numbers are never called." />
      }
    />
  );
}
