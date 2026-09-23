import { formatDate } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type AdvisorTeamResponse, inr, REPORTING_LABEL } from '@/lib/advisor-team';
import { apiFetch } from '@/lib/api';

const sel = 'border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm';

/**
 * F-315: the Manager's Advisors with their leads, real MIS results and payout position (REQ-15 §15.1).
 * Evidence per person — no ranking or score (REQ-15 §15.3). Same endpoint as the mobile Advisors tab.
 */
export default async function ManagerAdvisorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'bankId'] as const) if (sp[k]) qs.set(k, sp[k] as string);
  const [data, banks] = await Promise.all([
    apiFetch<AdvisorTeamResponse>(`/dashboards/manager/advisors?${qs.toString()}`).then((r) => r.data),
    apiFetch<{ banks: { id: string; displayName: string }[] }>('/leads/filters').then((r) => r.data.banks).catch(() => []),
  ]);
  const detail = (id: string) => `/manager/advisors/${id}${qs.toString() ? `?${qs.toString()}` : ''}`;
  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Advisors</h1>
        <p className="text-muted-foreground text-sm">
          {data.rows.length} Advisor{data.rows.length === 1 ? '' : 's'} reporting to you. Leads by KBS lead date; bank values are the latest accepted MIS only, never live bank status; payouts from the payout ledger.
        </p>
      </div>
      <form className="grid items-end gap-2 sm:grid-cols-4" action="/manager/advisors">
        <label className="grid gap-1 text-xs">
          Leads from
          <input className={sel} type="date" name="from" defaultValue={sp.from ?? ''} />
        </label>
        <label className="grid gap-1 text-xs">
          Leads to
          <input className={sel} type="date" name="to" defaultValue={sp.to ?? ''} />
        </label>
        <label className="grid gap-1 text-xs">
          Bank
          <select className={sel} name="bankId" defaultValue={sp.bankId ?? ''}>
            <option value="">All banks</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/manager/advisors">Reset</Link>
          </Button>
        </div>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Advisor results</CardTitle>
          <CardDescription>Listed by name. Open an Advisor for their leads, bank results and payout history.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Advisor</TableHead>
                <TableHead>Leads (KBS)</TableHead>
                <TableHead>Bank activation (MIS)</TableHead>
                <TableHead>Payout ledger</TableHead>
                <TableHead>Approvals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.user.id}>
                  <TableCell data-label="Advisor">
                    <Link className="font-medium underline-offset-2 hover:underline" href={detail(r.user.id)}>
                      {r.user.fullName || '(onboarding)'}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {r.reporting ? `${REPORTING_LABEL[r.reporting.source] ?? r.reporting.source}${r.reporting.agentCode ? ` ${r.reporting.agentCode}` : ''} · since ${formatDate(r.reporting.since)}` : 'No active reporting line'}
                    </div>
                    <Badge variant={r.user.status === 'ACTIVE' ? 'success' : 'unknown'} className="mt-1">
                      {r.user.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Leads (KBS)">
                    <span className="tabular-nums">{r.leads.created.value}</span> created
                    <div className="text-muted-foreground text-xs">
                      {r.leads.misMatched.value} of {r.leads.created.value} matched in MIS · {r.leads.awaitingMis.value} awaiting MIS
                    </div>
                  </TableCell>
                  <TableCell data-label="Bank activation (MIS)">
                    <ul className="grid gap-0.5 text-xs">
                      {r.activation.buckets.slice(0, 4).map((b) => (
                        <li key={b.value}>
                          <span className="font-mono">{b.value}</span> · {b.count}
                        </li>
                      ))}
                      {r.activation.buckets.length === 0 ? <li className="text-muted-foreground">No leads</li> : null}
                    </ul>
                  </TableCell>
                  <TableCell data-label="Payout ledger" className="text-xs">
                    <div>
                      Eligible {r.payouts.eligible.value} · {inr(r.payouts.eligible.amountInr)}
                    </div>
                    <div>
                      Approved, unpaid {r.payouts.approvedUnpaid.value} · {inr(r.payouts.approvedUnpaid.amountInr)}
                    </div>
                    <div>
                      Paid {r.payouts.paid.value} · {inr(r.payouts.paid.amountInr)}
                    </div>
                  </TableCell>
                  <TableCell data-label="Approvals">
                    {r.awaitingManagerApproval ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/manager/payouts/requests?awaitingMe=true">{r.awaitingManagerApproval} awaiting Manager</Link>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">None pending</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    No Advisors report to you yet. Advisors join your team when they apply one of your Agent Codes.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
