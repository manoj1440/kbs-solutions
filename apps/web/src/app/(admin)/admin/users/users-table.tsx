'use client';

import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { columnHelper, Dash, DataTable } from '@/components/data-table';
import { Avatar, EmptyState, humanize, StatusDot } from '@/components/ui/kit';
import { Users } from 'lucide-react';

import { roleChipClass, statusTone } from './user-status';

export interface UserRow {
  id: string;
  publicRef: string;
  role: string;
  status: string;
  fullName: string;
  mobileMasked: string;
  employeeCode: string | null;
  reportingParent: { fullName: string } | null;
  lastLoginAt: string | null;
}

const c = columnHelper<UserRow>();
const columns = c.columns([
  c.accessor('fullName', {
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar name={row.original.fullName || row.original.publicRef} size="sm" />
        <div className="min-w-0">
          <Link className="font-medium" href={`/admin/users/${row.original.id}`}>
            {row.original.fullName || '(onboarding)'}
          </Link>
          <div className="font-mono text-[11px] text-slate-500">{row.original.publicRef}</div>
        </div>
      </div>
    ),
  }),
  c.accessor('role', {
    header: 'Role',
    cell: ({ getValue }) => <span className={roleChipClass(getValue())}>{humanize(getValue())}</span>,
  }),
  c.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <StatusDot tone={statusTone(getValue())}>{humanize(getValue())}</StatusDot>,
  }),
  c.accessor('mobileMasked', {
    header: 'Mobile',
    meta: { className: 'font-mono text-xs text-slate-600' },
  }),
  c.accessor('employeeCode', {
    header: 'Code',
    meta: { className: 'font-mono text-xs text-slate-600' },
    cell: ({ getValue }) => getValue() ?? <Dash />,
  }),
  c.accessor((r) => r.reportingParent?.fullName ?? '', {
    id: 'reportingParent',
    header: 'Reports to',
    cell: ({ row }) =>
      row.original.reportingParent ? (
        <span className="inline-flex items-center gap-2 text-slate-700">
          <Avatar name={row.original.reportingParent.fullName} size="sm" className="size-6 text-[9px]" />
          {row.original.reportingParent.fullName}
        </span>
      ) : (
        <Dash />
      ),
  }),
  c.accessor('lastLoginAt', {
    header: 'Last login',
    sortFn: 'datetime',
    meta: { className: 'text-xs text-slate-600 tabular-nums' },
    cell: ({ getValue }) => (getValue() ? formatDateTime(getValue()) : <span className="text-slate-400">never</span>),
  }),
]);

export function UsersTable({ rows, filtered }: { rows: UserRow[]; filtered: boolean }) {
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      pagedOnServer
      empty={
        <EmptyState
          icon={Users}
          className="m-3"
          title={filtered ? 'No users match these filters' : 'No users yet'}
          description={filtered ? 'Clear the search or pick another role or status.' : 'Create a Manager or Accounts user; Advisors register themselves.'}
        />
      }
    />
  );
}
