'use client';

import { formatDateTime } from '@kbs/shared';
import { GitPullRequestArrow, Ticket } from 'lucide-react';

import { columnHelper, Dash, DataTable, DateTimeCell } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize } from '@/components/ui/kit';

import { PendingDecisionButtons, RevokeAgentCodeButton } from './agent-code-forms';

export interface AgentCode {
  id: string;
  code: string;
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  owner: { id: string; fullName: string; role: string };
  activeAdvisors: number;
}
export type AgentCodeRow = AgentCode & { state: 'ACTIVE' | 'REVOKED' | 'EXPIRED' };

export interface PendingChange {
  id: string;
  createdAt: string;
  reason: string | null;
  child: { id: string; fullName: string; publicRef: string; role: string };
  parent: { id: string; fullName: string; role: string };
  agentCode: { code: string } | null;
}

const STATE: Record<
  AgentCodeRow['state'],
  { label: string; variant: 'success' | 'unknown' | 'destructive' }
> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  EXPIRED: { label: 'Expired', variant: 'unknown' },
  REVOKED: { label: 'Revoked', variant: 'destructive' },
};

const codeClass =
  'rounded-md bg-surface-muted px-2 py-0.5 font-mono text-xs text-foreground ring-1 ring-border ring-inset';

const c = columnHelper<AgentCodeRow>();
const p = columnHelper<PendingChange>();

function Person({ name, sub, mono }: { name: string; sub: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} size="sm" />
      <div className="min-w-0">
        <div className="font-medium break-words text-foreground">{name}</div>
        <div
          className={
            mono ? 'font-mono text-2xs text-muted-foreground' : 'text-2xs text-muted-foreground'
          }
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

export function AgentCodesTable({ rows }: { rows: AgentCodeRow[] }) {
  const columns = c.columns([
    c.accessor('code', {
      header: 'Code',
      cell: ({ getValue }) => <code className={codeClass}>{getValue()}</code>,
    }),
    c.accessor((r) => r.owner.fullName, {
      id: 'owner',
      header: 'Owner',
      cell: ({ row }) => (
        <Person name={row.original.owner.fullName} sub={humanize(row.original.owner.role)} />
      ),
    }),
    c.accessor('state', {
      header: 'Status',
      cell: ({ row }) => (
        <>
          <Badge variant={STATE[row.original.state].variant}>
            {STATE[row.original.state].label}
          </Badge>
          {row.original.revokedAt ? (
            <div className="mt-0.5 text-2xs text-muted-foreground">
              {formatDateTime(row.original.revokedAt)}
            </div>
          ) : row.original.expiresAt ? (
            <div className="mt-0.5 text-2xs text-muted-foreground">
              {row.original.state === 'EXPIRED' ? 'since' : 'until'}{' '}
              {formatDateTime(row.original.expiresAt)}
            </div>
          ) : null}
        </>
      ),
    }),
    c.accessor('activeAdvisors', {
      header: 'Active advisors',
      meta: { cellClassName: 'tabular-nums' },
    }),
    c.accessor('createdAt', {
      header: 'Created',
      sortFn: 'datetime',
      cell: ({ getValue }) => <DateTimeCell value={getValue()} />,
    }),
    c.display({
      id: 'actions',
      header: 'Actions',
      meta: { hideLabel: true },
      cell: ({ row }) =>
        row.original.state === 'ACTIVE' ? (
          <RevokeAgentCodeButton id={row.original.id} code={row.original.code} />
        ) : null,
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={
        <EmptyState
          className="m-3 py-7"
          icon={Ticket}
          title="No Agent Codes yet"
          description="Create a code for a Manager above. Advisors enter it at signup or later in Profile."
        />
      }
    />
  );
}

export function PendingChangesTable({ rows }: { rows: PendingChange[] }) {
  const columns = p.columns([
    p.accessor((r) => r.child.fullName, {
      id: 'advisor',
      header: 'Advisor',
      cell: ({ row }) => (
        <Person
          name={row.original.child.fullName || '(onboarding)'}
          sub={row.original.child.publicRef}
          mono
        />
      ),
    }),
    p.accessor((r) => r.parent.fullName, {
      id: 'parent',
      header: 'Requested parent',
      cell: ({ row }) => (
        <Person name={row.original.parent.fullName} sub={humanize(row.original.parent.role)} />
      ),
    }),
    p.accessor((r) => r.agentCode?.code ?? '', {
      id: 'agentCode',
      header: 'Agent Code',
      cell: ({ row }) =>
        row.original.agentCode ? (
          <code className={codeClass}>{row.original.agentCode.code}</code>
        ) : (
          <Dash />
        ),
    }),
    p.accessor('createdAt', {
      header: 'Requested at',
      sortFn: 'datetime',
      cell: ({ getValue }) => <DateTimeCell value={getValue()} />,
    }),
    p.display({
      id: 'actions',
      header: 'Actions',
      meta: { hideLabel: true },
      cell: ({ row }) => (
        <PendingDecisionButtons
          id={row.original.id}
          advisor={row.original.child.fullName || row.original.child.publicRef}
        />
      ),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      empty={
        <EmptyState
          className="m-3 py-7"
          icon={GitPullRequestArrow}
          title="No reporting change is waiting for approval."
        />
      }
    />
  );
}
