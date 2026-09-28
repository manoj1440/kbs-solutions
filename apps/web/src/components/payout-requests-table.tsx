'use client';

import { formatDateTime, formatInr } from '@kbs/shared';
import { Check, Clock, Inbox, Minus, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { PayoutStateBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

export interface PayoutRequestRow {
  id: string;
  publicRef: string;
  state: string;
  advisor: { id: string; fullName: string };
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  approvals: { role: string; decision: string; at: string }[];
  outstanding: string[];
  payment: { state: string; paidAt: string; amountInr: number } | null;
  holdReason: string | null;
  paidAt: string | null;
  correctionPending: boolean;
}

const STEP: Record<'approved' | 'rejected' | 'pending' | 'none', { icon: LucideIcon; cls: string; text: string }> = {
  approved: { icon: Check, cls: 'bg-emerald-500 text-white', text: 'approved' },
  rejected: { icon: X, cls: 'bg-rose-500 text-white', text: 'rejected' },
  pending: {
    icon: Clock,
    cls: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-300',
    text: 'pending',
  },
  none: { icon: Minus, cls: 'bg-slate-100 text-slate-400', text: '—' },
};

/** Two-step approval trail (Manager → Admin) built from the row's approval records; text is always rendered. */
function ApprovalSteps({ row }: { row: PayoutRequestRow }) {
  const steps = (['MANAGER', 'ADMIN'] as const).map((role) => {
    const a = row.approvals.find((x) => x.role === role);
    const status: keyof typeof STEP = a ? (a.decision === 'APPROVED' ? 'approved' : 'rejected') : row.outstanding.includes(role) ? 'pending' : 'none';
    return { role, status };
  });
  return (
    <ol className="flex items-center gap-1.5" aria-label="Approvals">
      {steps.map(({ role, status }, i) => {
        const s = STEP[status];
        return (
          <li key={role} className="flex items-center gap-1.5">
            {i > 0 ? <span className={cn('h-px w-3 sm:w-4', steps[0].status === 'approved' ? 'bg-emerald-300' : 'bg-slate-200')} aria-hidden="true" /> : null}
            <span className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full', s.cls)} aria-hidden="true">
              <s.icon className="size-3" strokeWidth={3} />
            </span>
            <span className="leading-tight">
              <span className="block text-[12px] font-medium text-slate-800">{humanize(role)}</span>
              <span className="block text-[10.5px] text-slate-500">{s.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const c = columnHelper<PayoutRequestRow>();

/** F-603/F-604 → F-813 — payout requests with outstanding approvals; "awaiting me" shows the viewer's own queue. */
export function PayoutRequestsTable({ rows, basePath, mode }: { rows: PayoutRequestRow[]; basePath: string; mode: 'approvals' | 'accounts' }) {
  const columns = c.columns([
    c.accessor('publicRef', {
      header: 'Request',
      cell: ({ row }) => (
        <>
          <Link className="font-mono text-xs font-semibold" href={`${basePath}/${row.original.id}`}>
            {row.original.publicRef}
          </Link>
          <div className="mt-0.5 text-[11px] text-slate-500">{row.original.itemCount} card event(s)</div>
        </>
      ),
    }),
    c.accessor((r) => r.advisor.fullName, {
      id: 'advisor',
      header: 'Advisor',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.original.advisor.fullName} size="sm" />
          <span className="font-medium text-slate-800">{row.original.advisor.fullName}</span>
        </div>
      ),
    }),
    c.accessor('totalAmountInr', {
      header: 'Amount',
      meta: { align: 'right' },
      cell: ({ getValue }) => <span className="text-[15px] font-semibold whitespace-nowrap text-slate-900 tabular-nums">{formatInr(getValue())}</span>,
    }),
    c.accessor('state', {
      header: 'State',
      cell: ({ getValue }) => <PayoutStateBadge state={getValue()} />,
    }),
    mode === 'accounts'
      ? c.display({
          id: 'payment',
          header: 'Payment',
          meta: { cellClassName: 'text-xs' },
          cell: ({ row }) => {
            const x = row.original;
            return (
              <>
                {x.payment ? (
                  <span className="text-slate-700">
                    {humanize(x.payment.state)} · <span className="tabular-nums">{formatInr(x.payment.amountInr)}</span>
                  </span>
                ) : x.state === 'APPROVED' ? (
                  <span className="text-slate-500">Not yet recorded</span>
                ) : (
                  '—'
                )}
                {x.correctionPending ? (
                  <Badge variant="warning" className="ml-1">
                    correction awaiting Admin
                  </Badge>
                ) : null}
                {x.holdReason ? <div className="text-destructive mt-1 whitespace-normal">{x.holdReason}</div> : null}
              </>
            );
          },
        })
      : c.display({
          id: 'approvals',
          header: 'Approvals',
          meta: { cellClassName: 'text-xs' },
          cell: ({ row }) => {
            const x = row.original;
            return (
              <>
                <ApprovalSteps row={x} />
                {x.payment ? <div className="mt-1.5 text-[11px] text-slate-500">Payment {humanize(x.payment.state).toLowerCase()}</div> : null}
                {x.correctionPending ? (
                  <Badge variant="warning" className="mt-1.5">
                    correction awaiting Admin
                  </Badge>
                ) : null}
              </>
            );
          },
        }),
    c.accessor('submittedAt', {
      header: 'Submitted',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs whitespace-nowrap text-slate-600' },
      cell: ({ getValue }) => formatDateTime(getValue()),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      pagedOnServer
      empty={<EmptyState icon={Inbox} className="m-3" title="No requests." description="Nothing matches this queue right now." />}
    />
  );
}
