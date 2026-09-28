'use client';

import { formatDateTime } from '@kbs/shared';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

import { BankCell, columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, humanize } from '@/components/ui/kit';

export interface PincodeProfileRow {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
  sheetName: string | null;
  pincodeColumn: string;
  semantics: { rule: string };
  approvedAt: string | null;
  bank: { code: string; displayName: string };
  _count: { batches: number };
}

const c = columnHelper<PincodeProfileRow>();
const columns = c.columns([
  c.accessor((r) => r.bank.displayName, {
    id: 'bank',
    header: 'Bank',
    cell: ({ row }) => <BankCell code={row.original.bank.code} name={row.original.bank.displayName} />,
  }),
  c.accessor('name', {
    header: 'Profile',
    cell: ({ row }) => (
      <>
        <Link className="font-medium text-slate-900 hover:text-teal-700" href={`/admin/pincode-profiles/${row.original.id}`}>{row.original.name}</Link>{' '}
        <span className="text-[11px] text-slate-500">v{row.original.version}</span>
      </>
    ),
  }),
  c.accessor('status', {
    header: 'Status',
    cell: ({ row }) => (
      <>
        <Badge variant={row.original.status === 'APPROVED' ? 'success' : row.original.status === 'DRAFT' ? 'warning' : 'unknown'}>{humanize(row.original.status)}</Badge>
        {row.original.approvedAt ? <div className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(row.original.approvedAt)}</div> : null}
      </>
    ),
  }),
  c.accessor((r) => `${r.sheetName ?? '(first)'} ${r.pincodeColumn}`, {
    id: 'sheet',
    header: 'Sheet · pincode column',
    meta: { cellClassName: 'font-mono text-xs' },
    cell: ({ row }) => `${row.original.sheetName ?? '(first)'} · ${row.original.pincodeColumn}`,
  }),
  c.accessor((r) => r.semantics.rule, {
    id: 'rule',
    header: 'Rule',
    cell: ({ row }) => <Badge variant={row.original.semantics.rule === 'REQUIRES_BANK_MAPPING' ? 'warning' : 'secondary'}>{humanize(row.original.semantics.rule)}</Badge>,
  }),
  c.accessor((r) => r._count.batches, {
    id: 'batches',
    header: 'Batches',
      }),
]);

export function PincodeProfilesTable({ rows }: { rows: PincodeProfileRow[] }) {
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={
        <EmptyState icon={MapPin} className="m-3" title="No pincode profiles yet" description="No bank is sourceable for any pincode until a profile is approved and a batch imported under it." />
      }
    />
  );
}
