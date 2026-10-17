'use client';

import { formatDateTime } from '@kbs/shared';
import { MapPin } from 'lucide-react';

import { BankCell, columnHelper, DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/ui/kit';

export interface CoverageRow {
  bank: { id: string; code: string; displayName: string };
  live: { batchId: string; uploadedAt: string; rows: number | null; sourceable: number; fileName: string; uploadedBy: string } | null;
}

const c = columnHelper<CoverageRow>();
const columns = c.columns([
  c.accessor((r) => r.bank.displayName, {
    id: 'bank',
    header: 'Bank',
    cell: ({ row }) => <BankCell code={row.original.bank.code} name={row.original.bank.displayName} />,
  }),
  c.accessor((r) => r.live?.sourceable ?? -1, {
    id: 'sourceable',
    header: 'Pincodes sourced',
    meta: { cellClassName: 'tabular-nums' },
    cell: ({ row }) => (row.original.live ? row.original.live.sourceable.toLocaleString('en-IN') : <span className="text-xs text-muted-foreground">No list uploaded</span>),
  }),
  c.accessor((r) => r.live?.uploadedAt ?? '', {
    id: 'uploaded',
    header: 'Last upload',
    sortFn: 'datetime',
    meta: { cellClassName: 'text-xs' },
    cell: ({ row }) =>
      row.original.live ? (
        <>
          {formatDateTime(row.original.live.uploadedAt)}
          <div className="text-2xs break-all text-muted-foreground">
            {row.original.live.fileName} · {row.original.live.uploadedBy}
          </div>
        </>
      ) : (
        '—'
      ),
  }),
]);

/** F-816: per bank, the coverage list the apps read now. */
export function CoverageTable({ rows }: { rows: CoverageRow[] }) {
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.bank.id}
      empty={<EmptyState icon={MapPin} className="m-3" title="No banks yet" description="Add banks under Card catalogue first." />}
    />
  );
}
