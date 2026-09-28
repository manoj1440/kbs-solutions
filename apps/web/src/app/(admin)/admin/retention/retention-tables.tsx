'use client';

import { formatDateTime } from '@kbs/shared';
import { FileX2, Gavel, UserRoundX } from 'lucide-react';

import { columnHelper, Dash, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, IconTile } from '@/components/ui/kit';

import { RunRetention } from './actions';

export interface CategoryPlan {
  category: string;
  label: string;
  configKey: string;
  action: 'PURGE_FILE' | 'RESTRICT_RECORD';
  days: number | null;
  configured: boolean;
  cutoff: string | null;
  olderThanCutoff: number | null;
  onHold: number | null;
  protected: number | null;
  eligible: number | null;
  onHoldTotal: number;
  alreadyDone: number;
  runnable: boolean;
  blockedReason: string | null;
}
export interface Hold {
  subject: string;
  id: string;
  label: string;
  reason: string | null;
  createdAt: string;
  restricted?: boolean;
}

const nfmt = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-IN'));

const c = columnHelper<CategoryPlan>();
const h = columnHelper<Hold>();

export function RetentionPlanTable({ rows }: { rows: CategoryPlan[] }) {
  const columns = c.columns([
    c.accessor('label', {
      header: 'Category',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <IconTile icon={row.original.action === 'PURGE_FILE' ? FileX2 : UserRoundX} tone={row.original.action === 'PURGE_FILE' ? 'rose' : 'violet'} size="sm" />
          <div className="min-w-0">
            <div className="font-medium text-slate-800">{row.original.label}</div>
            <div className="text-xs text-slate-500">{row.original.action === 'PURGE_FILE' ? 'Purge file' : 'Restrict record'}</div>
          </div>
        </div>
      ),
    }),
    c.accessor((r) => r.days ?? -1, {
      id: 'retention',
      header: 'Retention',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) =>
        row.original.configured ? (
          <>
            <span className="font-medium text-slate-800 tabular-nums">{row.original.days} days</span>
            <div className="text-slate-500">before {row.original.cutoff ? formatDateTime(row.original.cutoff) : ''}</div>
          </>
        ) : (
          <Badge variant="unknown" className="whitespace-nowrap">not set</Badge>
        ),
    }),
    c.accessor((r) => r.olderThanCutoff ?? -1, { id: 'pastCutoff', header: 'Past cutoff', meta: { align: 'right' }, cell: ({ row }) => nfmt(row.original.olderThanCutoff) }),
    c.accessor((r) => r.onHold ?? -1, { id: 'onHold', header: 'Legal hold', meta: { align: 'right' }, cell: ({ row }) => nfmt(row.original.onHold) }),
    c.accessor((r) => r.protected ?? -1, { id: 'protected', header: 'Protected', meta: { align: 'right' }, cell: ({ row }) => nfmt(row.original.protected) }),
    c.accessor((r) => r.eligible ?? -1, {
      id: 'eligible',
      header: 'Eligible',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="font-semibold text-slate-900">{nfmt(row.original.eligible)}</span>,
    }),
    c.accessor('alreadyDone', { header: 'Done', meta: { align: 'right' }, cell: ({ getValue }) => nfmt(getValue()) }),
    c.display({
      id: 'actions',
      header: '',
      meta: { hideLabel: true, align: 'right' },
      cell: ({ row }) => <RunRetention category={row.original.category} label={row.original.label} runnable={row.original.configured && row.original.runnable} />,
    }),
  ]);
  return <DataTable variant="panel" responsive="compact" columns={columns} data={rows} getRowId={(r) => r.category} />;
}

export function LegalHoldsTable({ rows }: { rows: Hold[] }) {
  const columns = h.columns([
    h.accessor('label', {
      header: 'Item',
      cell: ({ row }) => (
        <>
          <div className="font-medium text-slate-800">{row.original.label}</div>
          <div className="font-mono text-[11px] break-all text-slate-500">{row.original.id}</div>
        </>
      ),
    }),
    h.accessor('reason', {
      header: 'Reason',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ getValue }) => getValue() ?? <Dash />,
    }),
    h.accessor('createdAt', {
      header: 'Created',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ getValue }) => formatDateTime(getValue()),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      responsive="compact"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={<EmptyState className="m-3 py-7" icon={Gavel} title="No items are on legal hold." description="Place a hold above by file or calling-record id to exclude it from every retention run." />}
    />
  );
}
