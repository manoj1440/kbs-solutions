'use client';

import { formatDateTime } from '@kbs/shared';
import { Activity, Building2, House } from 'lucide-react';

import { columnHelper, DataTable } from '@/components/data-table';
import { NetworkActiveToggle, RevokeWfhButton } from '@/components/network-policy';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize } from '@/components/ui/kit';
import { type WfhRow, wfhOpen } from '@/lib/wfh';

export interface Network {
  id: string;
  label: string;
  cidr: string;
  active: boolean;
  createdAt: string;
}
export interface AccessEvent {
  id: string;
  at: string;
  ip: string;
  ssidHint: string | null;
  outcome: 'DENIED' | 'ALLOWED_OFFICE' | 'ALLOWED_WFH';
  route: string | null;
  user: { id: string; fullName: string; employeeCode: string | null };
  matchedNetwork: { label: string } | null;
}

const OUTCOME: Record<
  AccessEvent['outcome'],
  { label: string; variant: 'destructive' | 'success' | 'info' }
> = {
  DENIED: { label: 'Denied', variant: 'destructive' },
  ALLOWED_OFFICE: { label: 'Office', variant: 'success' },
  ALLOWED_WFH: { label: 'WFH', variant: 'info' },
};

const n = columnHelper<Network>();
const w = columnHelper<WfhRow>();
const e = columnHelper<AccessEvent>();

export function NetworksTable({ rows }: { rows: Network[] }) {
  const columns = n.columns([
    n.accessor('label', {
      header: 'Label',
      cell: ({ row }) => (
        <>
          <div className="font-medium text-slate-800">{row.original.label}</div>
          <div className="text-[11px] text-slate-500">{formatDateTime(row.original.createdAt)}</div>
        </>
      ),
    }),
    n.accessor('cidr', {
      header: 'CIDR',
      cell: ({ getValue }) => <code className="rounded-md bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-800 ring-1 ring-slate-200 ring-inset">{getValue()}</code>,
    }),
    n.accessor('active', {
      header: 'Status',
      cell: ({ getValue }) => (getValue() ? <Badge variant="success">active</Badge> : <Badge variant="unknown">inactive</Badge>),
    }),
    n.display({
      id: 'actions',
      header: 'Actions',
      meta: { hideLabel: true, align: 'right' },
      cell: ({ row }) => <NetworkActiveToggle id={row.original.id} active={row.original.active} />,
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={<EmptyState className="m-3 py-7" icon={Building2} title="No office networks yet" description="Add the office egress CIDR above. Until one is active, only Telecallers with a WFH exception can call." />}
    />
  );
}

export function WfhTable({ rows }: { rows: WfhRow[] }) {
  const columns = w.columns([
    w.accessor((r) => r.telecaller?.fullName ?? r.telecallerUserId, {
      id: 'telecaller',
      header: 'Telecaller',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.original.telecaller?.fullName ?? row.original.telecallerUserId} size="sm" />
          <div className="min-w-0">
            <div className="font-medium text-slate-800">{row.original.telecaller?.fullName ?? row.original.telecallerUserId}</div>
            <div className="font-mono text-[11px] text-slate-500">{row.original.telecaller?.employeeCode}</div>
          </div>
        </div>
      ),
    }),
    w.accessor('startsAt', {
      header: 'Window',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ row }) => (
        <>
          {formatDateTime(row.original.startsAt)} → {row.original.endsAt ? formatDateTime(row.original.endsAt) : 'until revoked'}
          {row.original.revokedAt ? <div className="mt-0.5 text-rose-600">revoked {formatDateTime(row.original.revokedAt)}</div> : null}
          <div className="text-slate-500">by {row.original.grantedBy ? `${row.original.grantedBy.fullName} (${humanize(row.original.grantedBy.role)})` : '—'}</div>
        </>
      ),
    }),
    w.accessor('reason', {
      header: 'Reason',
      meta: { cellClassName: 'text-xs text-slate-600' },
    }),
    w.display({
      id: 'actions',
      header: 'Actions',
      meta: { hideLabel: true, align: 'right' },
      cell: ({ row }) => (!wfhOpen(row.original) ? null : <RevokeWfhButton id={row.original.id} />),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={<EmptyState className="m-3 py-7" icon={House} title="No WFH exceptions" description="Telecallers can call only from an office network until an exception is granted." />}
    />
  );
}

export function AccessEventsTable({ rows }: { rows: AccessEvent[] }) {
  const columns = e.columns([
    e.accessor('at', {
      header: 'When',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs whitespace-nowrap text-slate-600' },
      cell: ({ getValue }) => formatDateTime(getValue()),
    }),
    e.accessor((r) => r.user.fullName, {
      id: 'telecaller',
      header: 'Telecaller',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.original.user.fullName} size="sm" />
          <span className="font-medium text-slate-800">{row.original.user.fullName}</span>
        </div>
      ),
    }),
    e.accessor('outcome', {
      header: 'Outcome',
      cell: ({ row }) => (
        <>
          <Badge variant={OUTCOME[row.original.outcome].variant}>{OUTCOME[row.original.outcome].label}</Badge>
          {row.original.matchedNetwork ? <span className="ml-1 text-xs text-slate-500">{row.original.matchedNetwork.label}</span> : null}
        </>
      ),
    }),
    e.accessor('ip', {
      header: 'IP',
      meta: { cellClassName: 'font-mono text-xs text-slate-700' },
    }),
    e.accessor('ssidHint', {
      header: 'Wi-Fi hint',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ getValue }) => getValue() ?? '—',
    }),
    e.accessor('route', {
      header: 'Route',
      meta: { cellClassName: 'font-mono text-xs break-all text-slate-600' },
      cell: ({ getValue }) => getValue() ?? '—',
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      pagedOnServer
      empty={<EmptyState className="m-3" icon={Activity} title="No events" description="Denied and sampled allowed checks appear here." />}
    />
  );
}
