'use client';

import { formatInr } from '@kbs/shared';
import { CreditCard } from 'lucide-react';

import { columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/kit';

import { CardModalButton } from './card-modal';

export interface CardRow {
  id: string;
  name: string;
  status: string;
  categories: { key: string; label: string }[];
  joiningFee: number | null;
  annualFee: number | null;
  applyUrl: string | null;
  availability: { allIndia: boolean; pincodeCount: number };
}

const fee = (v: number | null) => (v == null ? '—' : formatInr(v, { decimals: 0 }));

export function CardsTable({
  rows,
  filtered,
  categories,
}: {
  rows: CardRow[];
  filtered: boolean;
  categories: { key: string; label: string }[];
}) {
  const c = columnHelper<CardRow>();
  const columns = c.columns([
    c.accessor('name', {
      header: 'Card',
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {row.original.categories.map((x) => x.label).join(' · ') || 'No categories'}
          </div>
        </>
      ),
    }),
    c.accessor((r) => r.joiningFee ?? -1, {
      id: 'fees',
      header: 'Joining / annual fee',
      meta: { cellClassName: 'text-xs tabular-nums' },
      cell: ({ row }) => `${fee(row.original.joiningFee)} / ${fee(row.original.annualFee)}`,
    }),
    c.accessor((r) => (r.availability.allIndia ? Infinity : r.availability.pincodeCount), {
      id: 'availability',
      header: 'Available in',
      cell: ({ row }) => {
        const a = row.original.availability;
        if (a.allIndia) return <Badge variant="success">All India</Badge>;
        if (a.pincodeCount)
          return <Badge variant="info">{a.pincodeCount.toLocaleString('en-IN')} pincodes</Badge>;
        return <Badge variant="destructive">Nowhere yet</Badge>;
      },
    }),
    c.accessor((r) => r.applyUrl ?? '', {
      id: 'link',
      header: 'Apply link',
      cell: ({ row }) => {
        const u = row.original.applyUrl;
        if (!u) return <Badge variant="destructive">Missing</Badge>;
        return /\{code\}/i.test(u) ? (
          <Badge variant="success">With agent code</Badge>
        ) : (
          <Badge variant="warning">No {'{code}'}</Badge>
        );
      },
    }),
    c.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) =>
        getValue() === 'PUBLISHED' ? (
          <Badge variant="success">Active</Badge>
        ) : getValue() === 'RETIRED' ? (
          <Badge variant="unknown">Retired</Badge>
        ) : (
          <Badge variant="unknown">Inactive</Badge>
        ),
    }),
    c.display({
      id: 'edit',
      header: '',
      meta: { cellClassName: 'text-right' },
      cell: ({ row }) =>
        row.original.status === 'RETIRED' ? null : (
          <CardModalButton cardId={row.original.id} categories={categories} />
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
          icon={CreditCard}
          className="m-3"
          title={filtered ? 'No cards match these filters.' : 'No cards yet.'}
          description={
            filtered ? 'Change or reset the filters.' : 'Use “Create card” to add the first one.'
          }
        />
      }
    />
  );
}
