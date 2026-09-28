'use client';

import { formatDateTime, formatInr } from '@kbs/shared';
import { ListChecks } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { PayoutStateBadge } from '@/components/status';
import { Avatar, BankMark, EmptyState } from '@/components/ui/kit';

export interface EntitlementDto {
  id: string;
  state: string;
  amountInr: number;
  eligibleAt: string;
  triggerField: string;
  triggerFieldValue: string;
  rule: { id: string; name: string; version: number };
  lead: { id: string; publicRef: string; customerFullName: string };
  advisor: { id: string; fullName: string };
  bank: { code: string; displayName: string };
  card: string;
  evidence: { batchRef: string; uploadedAt: string };
  reviewReason: string | null;
  currentRequestId: string | null;
  createdAt: string;
}

const c = columnHelper<EntitlementDto>();

/** F-602 → F-813 entitlement table: exact bank value, rule version and evidencing batch on every row. */
export function EntitlementsTable({ rows, leadBase }: { rows: EntitlementDto[]; leadBase: string }) {
  const columns = c.columns([
    c.accessor('state', {
      header: 'State',
      cell: ({ row }) => (
        <>
          <PayoutStateBadge state={row.original.state} />
          {row.original.reviewReason ? <div className="mt-1 max-w-56 text-[11px] whitespace-normal text-slate-500">{row.original.reviewReason}</div> : null}
        </>
      ),
    }),
    c.accessor((r) => r.lead.publicRef, {
      id: 'lead',
      header: 'Lead',
      meta: { cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <>
          <Link className="font-mono text-xs font-semibold" href={`${leadBase}/${row.original.lead.id}`}>
            {row.original.lead.publicRef}
          </Link>
          <div className="text-[11px] text-slate-500">{row.original.lead.customerFullName}</div>
        </>
      ),
    }),
    c.accessor((r) => r.advisor.fullName, {
      id: 'advisor',
      header: 'Advisor',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.original.advisor.fullName} size="sm" />
          <span className="whitespace-nowrap text-slate-800">{row.original.advisor.fullName}</span>
        </div>
      ),
    }),
    c.display({
      id: 'bankCard',
      header: 'Bank / card',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <BankMark code={row.original.bank.code} size="sm" />
          <div className="min-w-0">
            <div className="font-medium text-slate-800">{row.original.bank.displayName}</div>
            <div className="text-[11px] text-slate-500">{row.original.card}</div>
          </div>
        </div>
      ),
    }),
    c.accessor('triggerFieldValue', {
      header: 'Bank value (exact)',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <code>{row.original.triggerField}</code> = “{row.original.triggerFieldValue}”
        </>
      ),
    }),
    c.accessor((r) => r.rule.name, {
      id: 'rule',
      header: 'Rule',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          {row.original.rule.name} <span className="text-slate-500">v{row.original.rule.version}</span>
        </>
      ),
    }),
    c.accessor('amountInr', {
      header: 'Amount',
            cell: ({ getValue }) => <span className="font-semibold whitespace-nowrap text-slate-900">{formatInr(getValue())}</span>,
    }),
    c.accessor('eligibleAt', {
      header: 'Eligible at',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ getValue }) => formatDateTime(getValue()),
    }),
    c.accessor((r) => r.evidence.uploadedAt, {
      id: 'evidence',
      header: 'Evidence',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ row }) => (
        <>
          <span className="font-mono">{row.original.evidence.batchRef}</span> · {formatDateTime(row.original.evidence.uploadedAt)}
        </>
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
        <EmptyState icon={ListChecks} className="m-3" title="No entitlements." description="Entitlements appear once bank MIS evidence matches an approved payout rule." />
      }
    />
  );
}
