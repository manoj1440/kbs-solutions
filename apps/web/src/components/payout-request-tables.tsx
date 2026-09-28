'use client';

import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { ProofLink } from '@/components/payment-actions';
import { Badge } from '@/components/ui/badge';
import { BankMark } from '@/components/ui/kit';
import { PAYMENT_STATE } from '@/lib/payment-states';

export interface RequestItem {
  id: string;
  entitlementId: string;
  amountSnapshotInr: number;
  entitlementState: string;
  warnings: string[];
  lead: { id: string; publicRef: string; customerFullName: string };
  bank: { code: string; displayName: string };
  card: string;
  triggerField: string;
  triggerFieldValue: string;
  rule: { name: string; version: number };
  evidence: { batchRef: string; uploadedAt: string };
  eligibleAt: string;
  priorRequests: { id: string; publicRef: string; state: string; submittedAt: string }[];
}

export interface PaymentEntry {
  id: string;
  state: string;
  paidAt: string;
  amountInr: number;
  transferReference: string;
  method: string | null;
  proofFileId: string | null;
  proofAttachedAt: string | null;
  recordedBy: { id: string; fullName: string };
  recordedAt: string;
  exceptionReason: string | null;
  exceptionRaisedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  correctionOfId: string | null;
  correctionReason: string | null;
  correctionDecision: {
    by: { id: string; fullName: string } | null;
    at: string;
    reason: string | null;
  } | null;
  supersededAt: string | null;
}

const i = columnHelper<RequestItem>();

/** F-604 itemised card events: MIS evidence, rule/rate version, prior requests and warnings. */
export function RequestItemsTable({ rows, leadBase }: { rows: RequestItem[]; leadBase?: string }) {
  const columns = i.columns([
    i.accessor((r) => r.lead.publicRef, {
      id: 'lead',
      header: 'Lead',
      meta: { cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <>
          {leadBase ? (
            <Link className="font-mono text-xs font-semibold" href={`${leadBase}/${row.original.lead.id}`}>
              {row.original.lead.publicRef}
            </Link>
          ) : (
            <span className="font-mono text-xs font-semibold">{row.original.lead.publicRef}</span>
          )}
          <div className="text-[11px] text-slate-500">{row.original.lead.customerFullName}</div>
        </>
      ),
    }),
    i.display({
      id: 'bankCard',
      header: 'Bank / card',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <BankMark code={row.original.bank.code} size="sm" />
          <div className="min-w-0">
            <div className="font-medium text-slate-800">{row.original.bank.displayName}</div>
            <div className="text-[11px] text-slate-500">{row.original.card}</div>
          </div>
        </div>
      ),
    }),
    i.display({
      id: 'evidence',
      header: 'MIS evidence',
      meta: { cellClassName: 'text-xs whitespace-normal' },
      cell: ({ row }) => (
        <>
          <code>{row.original.triggerField}</code> = “{row.original.triggerFieldValue}”
          <div className="mt-0.5 text-[11px] text-slate-500">
            batch {row.original.evidence.batchRef} · {formatDateTime(row.original.evidence.uploadedAt)} · eligible {formatDateTime(row.original.eligibleAt)}
          </div>
        </>
      ),
    }),
    i.accessor((r) => r.rule.name, {
      id: 'rule',
      header: 'Rule',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          {row.original.rule.name} <span className="text-slate-500">v{row.original.rule.version}</span>
        </>
      ),
    }),
    i.accessor('amountSnapshotInr', {
      header: 'Amount',
      meta: { align: 'right' },
      cell: ({ getValue }) => <span className="font-semibold whitespace-nowrap text-slate-900">{formatInr(getValue())}</span>,
    }),
    i.display({
      id: 'warnings',
      header: 'Warnings / prior',
      meta: { cellClassName: 'text-xs whitespace-normal' },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <>
            {r.warnings.map((w) => (
              <Badge key={w} variant="warning" className="mr-1 mb-1">
                {w}
              </Badge>
            ))}
            {r.priorRequests.length ? <div className="text-slate-500">Prior: {r.priorRequests.map((p) => `${p.publicRef} (${p.state.toLowerCase()})`).join(', ')}</div> : null}
            {r.entitlementState !== 'RESERVED' && r.entitlementState !== 'PAID' ? <div className="text-slate-500">entitlement now {r.entitlementState.toLowerCase()}</div> : null}
            {!r.warnings.length && !r.priorRequests.length && (r.entitlementState === 'RESERVED' || r.entitlementState === 'PAID') ? <span className="text-slate-400">—</span> : null}
          </>
        );
      },
    }),
  ]);
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} />;
}

const p = columnHelper<PaymentEntry>();

/** F-605 payment trace rows: every entry incl. superseded ones (REQ-18 §18.3). */
export function PaymentHistoryTable({ rows }: { rows: PaymentEntry[] }) {
  const columns = p.columns([
    p.accessor('state', {
      header: 'Entry',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <Badge variant={PAYMENT_STATE[row.original.state]?.tone ?? 'unknown'}>{PAYMENT_STATE[row.original.state]?.label ?? row.original.state}</Badge>
          <div className="mt-1 text-[11px] text-slate-500">
            {row.original.recordedBy.fullName} · {formatDateTime(row.original.recordedAt)}
          </div>
        </>
      ),
    }),
    p.accessor('amountInr', {
      header: 'Transfer',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <span className="font-semibold text-slate-900 tabular-nums">{formatInr(row.original.amountInr)}</span> · {row.original.method ?? '—'}
          <div className="text-slate-600">
            <code>{row.original.transferReference}</code> · paid {formatDateTime(row.original.paidAt)}
          </div>
        </>
      ),
    }),
    p.display({
      id: 'proof',
      header: 'Proof',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (row.original.proofFileId ? <ProofLink fileId={row.original.proofFileId} /> : <span className="text-slate-500">none</span>),
    }),
    p.display({
      id: 'notes',
      header: 'Notes',
      meta: { cellClassName: 'text-xs whitespace-normal' },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <>
            {r.correctionReason ? <div>Correction: {r.correctionReason}</div> : null}
            {r.correctionDecision ? (
              <div className="text-slate-500">
                Admin {r.state === 'CORRECTION_REJECTED' ? 'rejected' : 'approved'} ({r.correctionDecision.by?.fullName ?? '—'}, {formatDateTime(r.correctionDecision.at)}): {r.correctionDecision.reason}
              </div>
            ) : null}
            {r.exceptionReason ? <div className="text-destructive">{r.exceptionReason}</div> : null}
            {r.resolutionNote ? <div className="text-slate-500">Resolved: {r.resolutionNote}</div> : null}
            {r.supersededAt ? <div className="text-slate-500">Superseded {formatDateTime(r.supersededAt)}</div> : null}
          </>
        );
      },
    }),
  ]);
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      getRowProps={(r) => ({ className: r.supersededAt ? 'opacity-70' : undefined })}
    />
  );
}
