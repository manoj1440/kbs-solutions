'use client';

import { formatDate } from '@kbs/shared';
import { Users } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, Meter, StatusDot } from '@/components/ui/kit';
import { type AdvisorTeamResponse, inr, REPORTING_LABEL } from '@/lib/advisor-team';

type Row = AdvisorTeamResponse['rows'][number];

const c = columnHelper<Row>();

/**
 * F-315 → F-813: Manager's Advisors — leads, real MIS results and payout position (REQ-15 §15.1).
 * Evidence per person — no ranking or score (REQ-15 §15.3).
 */
export function AdvisorsTable({ rows, qs }: { rows: Row[]; qs: string }) {
  const detail = (id: string) => `/manager/advisors/${id}${qs ? `?${qs}` : ''}`;
  const columns = c.columns([
    c.accessor((r) => r.user.fullName, {
      id: 'advisor',
      header: 'Advisor',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={r.user.fullName || r.user.publicRef} size="sm" />
            <div className="min-w-0">
              <Link className="font-medium" href={detail(r.user.id)}>
                {r.user.fullName || '(onboarding)'}
              </Link>
              <div className="font-mono text-[11px] text-slate-500">
                {r.user.publicRef} · {r.reporting ? `${REPORTING_LABEL[r.reporting.source] ?? r.reporting.source} ${r.reporting.agentCode ?? ''} · since ${formatDate(r.reporting.since)}` : 'No active reporting line'}
              </div>
              <div className="mt-0.5">
                <StatusDot tone={r.user.status === 'ACTIVE' ? 'emerald' : 'slate'}>{humanize(r.user.status)}</StatusDot>
              </div>
            </div>
          </div>
        );
      },
    }),
    c.accessor((r) => r.leads.created.value, {
      id: 'leads',
      header: 'Leads (KBS)',
            cell: ({ row }) => {
        const r = row.original;
        return (
          <>
            <div className="text-slate-900">
              <span className="text-base font-semibold tabular-nums">{r.leads.created.value}</span> created
            </div>
            <Meter
              value={r.leads.misMatched.value}
              max={r.leads.created.value}
              tone="indigo"
              className="my-1.5 h-1.5 w-full min-w-28 @min-[701px]:w-32"
              label={`${r.leads.misMatched.value} of ${r.leads.created.value} matched in MIS`}
            />
            <div className="text-xs text-slate-500 tabular-nums">
              {r.leads.misMatched.value} of {r.leads.created.value} matched in MIS · {r.leads.awaitingMis.value} awaiting MIS
            </div>
          </>
        );
      },
    }),
    c.display({
      id: 'activation',
      header: 'Bank activation (MIS)',
      cell: ({ row }) => (
        <ul className="grid gap-1 text-xs">
          {row.original.activation.buckets.slice(0, 4).map((b) => (
            <li key={b.value} className="flex items-baseline justify-between gap-3">
              <span
                className={
                  b.value === 'Awaiting MIS' || b.value === 'Not reported'
                    ? 'text-slate-500 italic'
                    : 'min-w-0 font-mono break-words text-slate-700'
                }
              >
                {b.value}
              </span>
              <span className="font-medium text-slate-900 tabular-nums">{b.count}</span>
            </li>
          ))}
          {row.original.activation.buckets.length === 0 ? <li className="text-slate-400">No leads</li> : null}
        </ul>
      ),
    }),
    c.display({
      id: 'payout',
      header: 'Payout ledger',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <dl className="grid grid-cols-[auto_auto_auto] justify-start gap-x-3 gap-y-0.5 tabular-nums">
          {(
            [
              ['Eligible', row.original.payouts.eligible],
              ['Approved, unpaid', row.original.payouts.approvedUnpaid],
              ['Paid', row.original.payouts.paid],
            ] as const
          ).map(([label, m]) => (
            <div key={label} className="contents">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-slate-700">{m.value}</dd>
              <dd className="font-medium text-slate-900">{inr(m.amountInr)}</dd>
            </div>
          ))}
        </dl>
      ),
    }),
    c.accessor('awaitingManagerApproval', {
      header: 'Approvals',
      cell: ({ getValue }) =>
        getValue() ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/manager/payouts/requests?awaitingMe=true">{getValue()} awaiting Manager</Link>
          </Button>
        ) : (
          <span className="text-xs text-slate-400">None pending</span>
        ),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.user.id}
      empty={
        <EmptyState className="m-3" icon={Users} title="No Advisors report to you yet" description="Advisors join your team when they apply one of your Agent Codes." />
      }
    />
  );
}
