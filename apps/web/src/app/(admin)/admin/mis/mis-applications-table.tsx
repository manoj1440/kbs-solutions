'use client';

import { formatDateTime } from '@kbs/shared';
import { Inbox } from 'lucide-react';
import Link from 'next/link';

import { BankCell, columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/kit';

export interface MisApplication {
  leadId: string;
  leadRef: string;
  customer: string;
  mobileMasked: string | null;
  pincode: string;
  bank: { code: string; displayName: string };
  batchId: string;
  batchRef: string;
  applicationNo: string | null;
  applicationReferenceNumber: string | null;
  currentStage: string | null;
  finalDecision: string | null;
  cardActivationStatus: string | null;
  productCode: string | null;
  productDescription: string | null;
  reportedAt: string;
}

/** Bank values render verbatim (INV-02/03); only the tone is guessed for the badge. */
const statusBadge = (v: string | null) => {
  if (!v) return <span className="text-xs text-fg-3">—</span>;
  const low = v.toLowerCase();
  const variant = low.includes('approv') || (low.includes('active') && !low.includes('inactiv')) ? 'success' : low.includes('declin') || low.includes('reject') || low.includes('inactiv') ? 'destructive' : 'info';
  return <Badge variant={variant as 'success' | 'destructive' | 'info'}>{v}</Badge>;
};

const c = columnHelper<MisApplication>();
const columns = c.columns([
  c.accessor((r) => r.applicationNo ?? r.applicationReferenceNumber ?? r.leadRef, {
    id: 'application',
    header: 'Application',
    cell: ({ row }) => (
      <>
        <Link href={`/admin/leads/${row.original.leadId}`} className="font-mono text-xs font-medium text-neutral-900 hover:underline">
          {row.original.applicationNo ?? row.original.applicationReferenceNumber ?? row.original.leadRef}
        </Link>
        {row.original.applicationReferenceNumber && row.original.applicationNo ? (
          <div className="mt-0.5 font-mono text-2xs text-muted-foreground">{row.original.applicationReferenceNumber}</div>
        ) : null}
      </>
    ),
  }),
  c.accessor((r) => r.bank.code, {
    id: 'bank',
    header: 'Bank',
    cell: ({ row }) => <BankCell code={row.original.bank.code} />,
  }),
  c.accessor('customer', {
    header: 'Customer',
    meta: { cellClassName: 'text-xs' },
    cell: ({ row }) => (
      <>
        <div className="font-medium text-foreground">{row.original.customer}</div>
        <div className="mt-0.5 text-muted-foreground">
          {row.original.leadRef} · {row.original.mobileMasked ?? '—'} · {row.original.pincode}
        </div>
      </>
    ),
  }),
  c.accessor((r) => r.productCode ?? '', {
    id: 'product',
    header: 'Product',
    meta: { cellClassName: 'text-xs' },
    cell: ({ row }) => (
      <>
        <div className="font-mono">{row.original.productCode ?? '—'}</div>
        {row.original.productDescription ? <div className="mt-0.5 max-w-40 truncate text-muted-foreground">{row.original.productDescription}</div> : null}
      </>
    ),
  }),
  c.accessor((r) => r.currentStage ?? '', {
    id: 'stage',
    header: 'Stage',
    meta: { cellClassName: 'text-xs font-medium text-fg-2' },
    cell: ({ getValue }) => getValue() || <span className="text-fg-3">—</span>,
  }),
  c.accessor((r) => r.finalDecision ?? '', {
    id: 'decision',
    header: 'Decision',
    cell: ({ row }) => statusBadge(row.original.finalDecision),
  }),
  c.accessor((r) => r.cardActivationStatus ?? '', {
    id: 'activation',
    header: 'Card activation',
    cell: ({ row }) => statusBadge(row.original.cardActivationStatus),
  }),
  c.accessor('reportedAt', {
    header: 'Reported',
    sortFn: 'datetime',
    cell: ({ row }) => (
      <>
        <div className="text-xs text-fg-2">{formatDateTime(row.original.reportedAt)}</div>
        <Link href={`/admin/mis/batches/${row.original.batchId}`} className="mt-0.5 block font-mono text-2xs text-muted-foreground hover:text-neutral-900 hover:underline">
          {row.original.batchRef}
        </Link>
      </>
    ),
  }),
]);

export function MisApplicationsTable({ rows, filtered }: { rows: MisApplication[]; filtered: boolean }) {
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.leadId}
      pagedOnServer
      empty={
        <EmptyState
          icon={Inbox}
          className="m-3"
          title={filtered ? 'No applications match these filters.' : 'Nothing reported by the banks yet.'}
          description={filtered ? 'Change or reset the filters.' : 'Upload the bank MIS file to see application status here.'}
        />
      }
    />
  );
}
