'use client';

import { formatDate, formatDateTime, type LeadStatusRow } from '@kbs/shared';
import { BadgeCheck, ListChecks, Wallet } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import type { EntitlementDto } from '@/components/entitlements-table';
import { ActivationBadge, DecisionBadge, PayoutStateBadge, StageBadge } from '@/components/status';
import { BankMark, EmptyState } from '@/components/ui/kit';
import { inr } from '@/lib/advisor-team';

export interface AdvisorRequestRow {
  id: string;
  publicRef: string;
  state: string;
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  outstanding: string[];
  paidAt: string | null;
}

const l = columnHelper<LeadStatusRow>();
const r = columnHelper<AdvisorRequestRow>();
const e = columnHelper<EntitlementDto>();

export function AdvisorLeadsTable({ rows }: { rows: LeadStatusRow[] }) {
  const columns = l.columns([
    l.accessor((x) => x.customer.name, {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <>
          <Link className="font-medium" href={`/manager/leads/${row.original.id}`}>
            {row.original.customer.name}
          </Link>
          <div className="font-mono text-[11px] text-slate-500">{row.original.kbsRef}</div>
        </>
      ),
    }),
    l.display({
      id: 'bankCard',
      header: 'Bank / card',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <BankMark code={row.original.bank.code} size="sm" />
          <div className="min-w-0 text-xs">
            <div className="font-medium text-slate-800">{row.original.bank.displayName}</div>
            <div className="text-slate-500">{row.original.card.name}</div>
          </div>
        </div>
      ),
    }),
    l.display({
      id: 'bankStatus',
      header: 'Bank status (MIS)',
      cell: ({ row }) => (
        <>
          <div className="flex flex-wrap gap-1">
            <StageBadge field={row.original.stage} />
            <DecisionBadge field={row.original.decision} />
            <ActivationBadge field={row.original.activation} />
          </div>
          {row.original.remarksPreview ? <div className="mt-1 line-clamp-2 text-xs text-slate-500">{row.original.remarksPreview}</div> : null}
        </>
      ),
    }),
    l.accessor('leadCreatedAt', {
      header: 'Created',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs whitespace-nowrap text-slate-600 tabular-nums' },
      cell: ({ getValue }) => formatDate(getValue()),
    }),
  ]);
  return <DataTable columns={columns} data={rows} getRowId={(x) => x.id} empty={<EmptyState icon={ListChecks} title="No leads yet." />} />;
}

export function AdvisorRequestsTable({ rows }: { rows: AdvisorRequestRow[] }) {
  const columns = r.columns([
    r.accessor('publicRef', {
      header: 'Request',
      cell: ({ row }) => (
        <>
          <Link className="font-mono text-xs" href={`/manager/payouts/requests/${row.original.id}`}>
            {row.original.publicRef}
          </Link>
          <div className="text-xs text-slate-500 tabular-nums">submitted {formatDateTime(row.original.submittedAt)}</div>
        </>
      ),
    }),
    r.accessor('totalAmountInr', {
      header: 'Amount',
      meta: { align: 'right', cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <div className="text-sm font-semibold whitespace-nowrap text-slate-900">{inr(row.original.totalAmountInr)}</div>
          <div className="text-slate-500">{row.original.itemCount} card event(s)</div>
        </>
      ),
    }),
    r.accessor('state', {
      header: 'State',
      cell: ({ row }) => (
        <>
          <PayoutStateBadge state={row.original.state} />
          {row.original.outstanding.length ? <div className="mt-1 text-xs text-slate-500">Waiting: {row.original.outstanding.join(' + ').toLowerCase()}</div> : null}
          {row.original.paidAt ? <div className="mt-1 text-xs text-slate-500 tabular-nums">Paid {formatDate(row.original.paidAt)}</div> : null}
        </>
      ),
    }),
  ]);
  return <DataTable responsive="compact" columns={columns} data={rows} getRowId={(x) => x.id} empty={<EmptyState icon={Wallet} title="No payout requests yet." />} />;
}

export function AdvisorEntitlementsTable({ rows }: { rows: EntitlementDto[] }) {
  const columns = e.columns([
    e.accessor((x) => x.lead.customerFullName, {
      id: 'lead',
      header: 'Lead',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <BankMark code={row.original.bank.code} size="sm" />
          <div className="min-w-0">
            <Link className="font-medium" href={`/manager/leads/${row.original.lead.id}`}>
              {row.original.lead.customerFullName}
            </Link>
            <div className="text-xs text-slate-500">
              {row.original.bank.displayName} · {row.original.card}
            </div>
          </div>
        </div>
      ),
    }),
    e.accessor('triggerFieldValue', {
      header: 'MIS evidence',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <span className="font-mono break-words text-slate-800">
            {row.original.triggerField} = {row.original.triggerFieldValue}
          </span>
          <div className="text-slate-500 tabular-nums">
            batch {row.original.evidence.batchRef} · {formatDate(row.original.eligibleAt)}
          </div>
        </>
      ),
    }),
    e.accessor('amountInr', {
      header: 'Amount / state',
      meta: { align: 'right', cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <div className="text-sm font-semibold whitespace-nowrap text-slate-900 tabular-nums">{inr(row.original.amountInr)}</div>
          <div className="mt-1">
            <PayoutStateBadge state={row.original.state} />
          </div>
        </>
      ),
    }),
  ]);
  return (
    <DataTable
      responsive="compact"
      columns={columns}
      data={rows}
      getRowId={(x) => x.id}
      empty={<EmptyState icon={BadgeCheck} title="No eligible card events yet." />}
    />
  );
}
