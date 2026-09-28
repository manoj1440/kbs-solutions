'use client';

import { formatDate, formatDateTime, type PayoutRuleView } from '@kbs/shared';
import { IndianRupee } from 'lucide-react';

import { columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, humanize } from '@/components/ui/kit';

type Rate = PayoutRuleView['rates'][number];
const STATUS: Record<string, 'success' | 'warning' | 'unknown'> = {
  APPROVED: 'success',
  DRAFT: 'warning',
  RETIRED: 'unknown',
};

const c = columnHelper<Rate>();

/** F-601 rates table — the row matching the current rate is marked and tinted. */
export function RatesTable({ rows, currentId }: { rows: Rate[]; currentId: string | undefined }) {
  const columns = c.columns([
    c.accessor('effectiveFrom', {
      header: 'Effective',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => `${formatDate(row.original.effectiveFrom)} → ${row.original.effectiveTo ? formatDate(row.original.effectiveTo) : 'open'}`,
    }),
    c.accessor('status', {
      header: 'Status',
      cell: ({ row }) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Badge variant={STATUS[row.original.status] ?? 'secondary'}>{humanize(row.original.status)}</Badge>
          {currentId === row.original.id ? <Badge variant="info">in force</Badge> : null}
        </span>
      ),
    }),
    c.accessor((r) => r.approvedAt ?? '', {
      id: 'approved',
      header: 'Approved',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ row }) => (row.original.approvedAt ? `${formatDateTime(row.original.approvedAt)} · ${row.original.approvedBy?.fullName ?? '—'}` : '—'),
    }),
    c.accessor('amountInr', {
      header: 'Amount',
            cell: ({ getValue }) => <span className="text-[15px] font-semibold text-slate-900">₹{getValue().toLocaleString('en-IN')}</span>,
    }),
  ]);
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      getRowProps={(r) => ({ 'data-current': currentId === r.id || undefined, className: currentId === r.id ? 'bg-teal-50/40' : undefined })}
      empty={<EmptyState icon={IndianRupee} title="No rate yet — the rule cannot price an entitlement until a rate is approved." />}
    />
  );
}
