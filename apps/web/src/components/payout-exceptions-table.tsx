'use client';

import { formatDateTime, formatInr } from '@kbs/shared';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { AcknowledgeException } from '@/components/payout-exception-ack';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState } from '@/components/ui/kit';

export interface ExceptionItem {
  kind: string;
  subjectId: string;
  request: { id: string; publicRef: string; state: string } | null;
  advisor: { id: string; fullName: string } | null;
  amountInr: number | null;
  detail: string;
  raisedAt: string;
  acknowledgeable: boolean;
  resolvedVia: string | null;
}

const KIND_LABEL: Record<string, string> = {
  PAYMENT_EXCEPTION: 'Payment exception',
  DISCREPANCY_HOLD: 'Returned to Admin',
  MISSING_PROOF: 'Proof missing',
  CORRECTION_PENDING: 'Correction awaiting Admin',
  STALE_REQUEST: 'Stale approval',
  MIS_CORRECTION_AFTER_PAYMENT: 'MIS changed after payment',
  UNDER_REVIEW_IN_REQUEST: 'Under review in request',
};

const c = columnHelper<ExceptionItem>();

/** F-606 exceptions table — derived from the ledger; nothing here claws back or refunds money. */
export function PayoutExceptionsTable({ rows, requestBase, canAcknowledge }: { rows: ExceptionItem[]; requestBase: string; canAcknowledge: boolean }) {
  const columns = c.columns([
    c.accessor('kind', {
      header: 'Kind',
      cell: ({ row }) => (
        <>
          <Badge variant="warning">{KIND_LABEL[row.original.kind] ?? row.original.kind}</Badge>
          <div className="mt-1 text-[11px] text-slate-500">{formatDateTime(row.original.raisedAt)}</div>
        </>
      ),
    }),
    c.display({
      id: 'subject',
      header: 'Request / Advisor',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex items-center gap-2.5">
            {e.advisor ? <Avatar name={e.advisor.fullName} size="sm" /> : null}
            <div className="min-w-0">
              {e.request ? (
                <Link className="font-mono text-xs" href={`${requestBase}/${e.request.id}`}>
                  {e.request.publicRef}
                </Link>
              ) : (
                '—'
              )}
              <div className="text-slate-500">{e.advisor?.fullName ?? ''}</div>
            </div>
          </div>
        );
      },
    }),
    c.accessor('detail', {
      header: 'Detail',
      meta: { cellClassName: 'max-w-md text-xs whitespace-normal text-slate-700' },
    }),
    c.accessor((r) => r.amountInr ?? -1, {
      id: 'amount',
      header: 'Amount',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.amountInr !== null ? formatInr(row.original.amountInr) : '—'}</span>,
    }),
    c.display({
      id: 'resolution',
      header: 'Resolution',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) =>
        row.original.acknowledgeable && canAcknowledge ? (
          <AcknowledgeException kind={row.original.kind} subjectId={row.original.subjectId} />
        ) : (
          <span className="text-slate-500">{row.original.resolvedVia ?? 'Admin/Accounts acknowledge'}</span>
        ),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => `${r.kind}:${r.subjectId}`}
      empty={
        <EmptyState icon={CheckCircle2} className="m-3" title="No open exceptions." description="Exceptions appear here when the ledger finds a payment issue, a stale approval or a bank correction after payment." />
      }
    />
  );
}
