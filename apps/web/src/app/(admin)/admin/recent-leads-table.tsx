'use client';

import { formatDateTime, type LeadStatusRow } from '@kbs/shared';
import { Inbox } from 'lucide-react';
import Link from 'next/link';

import { BankCell, columnHelper, DataTable } from '@/components/data-table';
import { ActivationBadge, DecisionBadge, StageBadge } from '@/components/status';
import { EmptyState } from '@/components/ui/kit';

const c = columnHelper<LeadStatusRow>();
const columns = c.columns([
  c.accessor((r) => r.customer.name, {
    id: 'customer',
    header: 'Customer',
    cell: ({ row }) => (
      <>
        <Link href={`/admin/leads/${row.original.id}`} className="text-xs font-medium text-teal-700 hover:underline">
          {row.original.customer.name}
        </Link>
        <div className="mt-0.5 text-[11px] text-slate-500">
          {row.original.kbsRef}
          {row.original.customer.mobileMasked ? ` · ${row.original.customer.mobileMasked}` : ''}
        </div>
      </>
    ),
  }),
  c.accessor((r) => r.bank.code, {
    id: 'bankCard',
    header: 'Bank / card',
    cell: ({ row }) => (
      <>
        <BankCell code={row.original.bank.code} />
        <div className="mt-0.5 max-w-40 truncate text-[11px] text-slate-500">{row.original.card.name}</div>
      </>
    ),
  }),
  c.accessor((r) => r.stage.display, {
    id: 'stage',
    header: 'Stage',
    cell: ({ row }) => <StageBadge field={row.original.stage} label={null} />,
  }),
  c.accessor((r) => r.decision.display, {
    id: 'decision',
    header: 'Decision',
    cell: ({ row }) => <DecisionBadge field={row.original.decision} label={null} />,
  }),
  c.accessor((r) => r.activation.display, {
    id: 'activation',
    header: 'Card activation',
    cell: ({ row }) => <ActivationBadge field={row.original.activation} label={null} />,
  }),
  c.accessor('leadCreatedAt', {
    header: 'Created',
    sortFn: 'datetime',
    cell: ({ row }) => (
      <>
        <div className="text-xs text-slate-700">{formatDateTime(row.original.leadCreatedAt)}</div>
        <div className="mt-0.5 text-[11px] text-slate-500">{row.original.lastMatchedAt ? `MIS ${formatDateTime(row.original.lastMatchedAt)}` : 'Awaiting MIS'}</div>
      </>
    ),
  }),
]);

/** F-812: recent leads on the Admin home — newest in the period, bank values verbatim. */
export function RecentLeadsTable({ rows }: { rows: LeadStatusRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      containerClassName="rounded-none! border-0!"
      empty={<EmptyState icon={Inbox} className="m-3" title="No leads created in this period." description="Widen the date range or check All time." />}
    />
  );
}
