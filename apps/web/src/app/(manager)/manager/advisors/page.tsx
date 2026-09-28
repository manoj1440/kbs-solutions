import { formatDate } from '@kbs/shared';
import { Filter, Users } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Avatar,
  EmptyState,
  humanize,
  Meter,
  MiniStat,
  selectClass,
  StatusDot,
} from '@/components/ui/kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type AdvisorTeamResponse, inr, REPORTING_LABEL } from '@/lib/advisor-team';
import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Advisors · KBS Solutions' };

/**
 * F-315 → F-811: the Manager's Advisors with their leads, real MIS results and payout position (REQ-15 §15.1).
 * Evidence per person — no ranking or score (REQ-15 §15.3). Same endpoint as the mobile Advisors tab.
 */
export default async function ManagerAdvisorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'bankId'] as const) if (sp[k]) qs.set(k, sp[k] as string);
  const [data, banks] = await Promise.all([
    apiFetch<AdvisorTeamResponse>(`/dashboards/manager/advisors?${qs.toString()}`).then(
      (r) => r.data,
    ),
    apiFetch<{ banks: { id: string; displayName: string }[] }>('/leads/filters')
      .then((r) => r.data.banks)
      .catch(() => []),
  ]);
  const detail = (id: string) =>
    `/manager/advisors/${id}${qs.toString() ? `?${qs.toString()}` : ''}`;
  // KPIs are sums of the rows below (every Advisor reporting to you, in the chosen range).
  const sum = (f: (r: AdvisorTeamResponse['rows'][number]) => number) =>
    data.rows.reduce((a, r) => a + f(r), 0);
  const active = data.rows.filter((r) => r.user.status === 'ACTIVE').length;
  const created = sum((r) => r.leads.created.value);
  const matched = sum((r) => r.leads.misMatched.value);
  const awaitingMis = sum((r) => r.leads.awaitingMis.value);
  const awaitingMe = sum((r) => r.awaitingManagerApproval);
  const range = qs.toString() ? 'In the chosen range' : 'All time';
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Advisors</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Reporting to you" value={data.rows.length} hint={`${active} active`} tone="violet" />
        <MiniStat label="Leads created" value={created} hint={range} tone="sky" />
        <MiniStat label="Matched in bank MIS" value={matched} hint={`of ${created} · ${awaitingMis} awaiting`} tone="indigo" />
        <MiniStat label="Awaiting my approval" value={awaitingMe} hint="Payout requests" tone={awaitingMe ? 'amber' : 'slate'} href={awaitingMe ? '/manager/payouts/requests?awaitingMe=true' : undefined} />
      </div>
      <section aria-label="Advisor results" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <Form
          className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3"
          action="/manager/advisors"
        >
          <input aria-label="Leads from" className={`${selectClass} h-9 w-36`} type="date" name="from" defaultValue={sp.from ?? ''} />
          <input aria-label="Leads to" className={`${selectClass} h-9 w-36`} type="date" name="to" defaultValue={sp.to ?? ''} />
          <select aria-label="Bank" id="bankId" className={`${selectClass} h-9 min-w-36`} name="bankId" defaultValue={sp.bankId ?? ''}>
            <option value="">All banks</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-9">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href="/manager/advisors">Reset</Link>
          </Button>
        </Form>
        <div className="min-h-0 flex-1">
          {data.rows.length === 0 ? (
            <EmptyState className="m-3" icon={Users} title="No Advisors report to you yet" description="Advisors join your team when they apply one of your Agent Codes." />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Advisor</TableHead>
                  <TableHead className="text-right">Leads (KBS)</TableHead>
                  <TableHead>Bank activation (MIS)</TableHead>
                  <TableHead className="text-right">Payout ledger</TableHead>
                  <TableHead className="pr-4">Approvals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.user.id}>
                    <TableCell className="pl-4" data-label="Advisor">
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
                            <StatusDot tone={r.user.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                              {humanize(r.user.status)}
                            </StatusDot>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-label="Leads (KBS)" className="@min-[701px]:text-right">
                      <div className="text-slate-900">
                        <span className="text-base font-semibold tabular-nums">{r.leads.created.value}</span> created
                      </div>
                      <Meter
                        value={r.leads.misMatched.value}
                        max={r.leads.created.value}
                        tone="indigo"
                        className="my-1.5 h-1.5 w-full min-w-28 @min-[701px]:ml-auto @min-[701px]:w-32"
                        label={`${r.leads.misMatched.value} of ${r.leads.created.value} matched in MIS`}
                      />
                      <div className="text-xs text-slate-500 tabular-nums">
                        {r.leads.misMatched.value} of {r.leads.created.value} matched in MIS · {r.leads.awaitingMis.value} awaiting MIS
                      </div>
                    </TableCell>
                    <TableCell data-label="Bank activation (MIS)">
                      <ul className="grid gap-1 text-xs">
                        {r.activation.buckets.slice(0, 4).map((b) => (
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
                        {r.activation.buckets.length === 0 ? (
                          <li className="text-slate-400">No leads</li>
                        ) : null}
                      </ul>
                    </TableCell>
                    <TableCell data-label="Payout ledger" className="text-xs">
                      <dl className="grid grid-cols-[auto_auto_auto] justify-start gap-x-3 gap-y-0.5 tabular-nums @min-[701px]:justify-end">
                        {(
                          [
                            ['Eligible', r.payouts.eligible],
                            ['Approved, unpaid', r.payouts.approvedUnpaid],
                            ['Paid', r.payouts.paid],
                          ] as const
                        ).map(([label, m]) => (
                          <div key={label} className="contents">
                            <dt className="text-slate-500">{label}</dt>
                            <dd className="text-right text-slate-700">{m.value}</dd>
                            <dd className="text-right font-medium text-slate-900">{inr(m.amountInr)}</dd>
                          </div>
                        ))}
                      </dl>
                    </TableCell>
                    <TableCell className="pr-4" data-label="Approvals">
                      {r.awaitingManagerApproval ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href="/manager/payouts/requests?awaitingMe=true">{r.awaitingManagerApproval} awaiting Manager</Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">None pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 items-center border-t border-slate-100 px-4 py-2 text-xs text-slate-500 tabular-nums">
          {data.rows.length} Advisor{data.rows.length === 1 ? '' : 's'}
        </div>
      </section>
    </div>
  );
}
