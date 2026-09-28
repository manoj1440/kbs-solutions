'use client';

import { UserRound } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { Avatar, EmptyState, humanize, StatusDot, type Tone } from '@/components/ui/kit';

export interface TeamAdvisorRow {
  id: string;
  fullName: string;
  role: string;
  status: string;
  mobileMasked: string;
}

/** F-806: dot tone per KBS user status (the humanised text carries the meaning). */
const userStatusTone = (s: string): Tone => (s === 'ACTIVE' ? 'emerald' : s === 'PENDING_ONBOARDING' ? 'amber' : s === 'BLOCKED' ? 'rose' : 'slate');

const c = columnHelper<TeamAdvisorRow>();
const columns = c.columns([
  c.accessor('fullName', {
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={row.original.fullName || '?'} size="sm" />
        <Link href={`/manager/advisors/${row.original.id}`} className="font-medium">
          {row.original.fullName || '(onboarding)'}
        </Link>
      </div>
    ),
  }),
  c.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <StatusDot tone={userStatusTone(getValue())}>{humanize(getValue())}</StatusDot>,
  }),
  c.accessor('mobileMasked', {
    header: 'Mobile',
    meta: { cellClassName: 'font-mono text-xs' },
  }),
]);

export function TeamAdvisorsTable({ rows }: { rows: TeamAdvisorRow[] }) {
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={
        <EmptyState icon={UserRound} className="m-3" title="No Advisors yet" description="Advisors join your team when they apply one of your Agent Codes." />
      }
    />
  );
}
