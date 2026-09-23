import { formatDate, formatDateTime, type LeadStatusRow } from '@kbs/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { EntitlementDto } from '@/components/entitlements-ledger';
import { ActivationBadge, DecisionBadge, PayoutStateBadge, StageBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type AdvisorTeamResponse, type Distribution, inr, type Metric, REPORTING_LABEL, SOURCE_LABEL } from '@/lib/advisor-team';
import { ApiError, apiFetch } from '@/lib/api';

interface RequestRow {
  id: string;
  publicRef: string;
  state: string;
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  outstanding: string[];
  paidAt: string | null;
}

function Tile({ label, m, money }: { label: string; m: Metric; money?: boolean }) {
  return (
    <div className="bg-card min-w-0 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{m.value}</p>
      <p className="text-muted-foreground text-xs">
        {money ? `${inr(m.amountInr)} · ` : ''}
        {m.denominator ? `of ${m.denominator.value} ${m.denominator.label} · ` : ''}
        {SOURCE_LABEL[m.source] ?? m.source}
      </p>
    </div>
  );
}

function Dist({ title, d }: { title: string; d: Distribution }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          Bank MIS values verbatim · {d.denominator.value} {d.denominator.label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {d.buckets.length ? (
          <ul className="grid gap-1 text-sm">
            {d.buckets.map((b) => (
              <li key={b.value} className="flex justify-between gap-2">
                <span className={b.value === 'Awaiting MIS' || b.value === 'Not reported' ? 'text-muted-foreground italic' : 'min-w-0 font-mono break-all'}>{b.value}</span>
                <span className="tabular-nums">{b.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No leads in this range.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** F-315: one Advisor's leads, bank results and payout history for their Manager (REQ-15 §15.3). Read-only evidence. */
export default async function ManagerAdvisorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams({ advisorId: id });
  for (const k of ['from', 'to', 'bankId'] as const) if (sp[k]) qs.set(k, sp[k] as string);
  let data: AdvisorTeamResponse;
  try {
    data = (await apiFetch<AdvisorTeamResponse>(`/dashboards/manager/advisors?${qs.toString()}`)).data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const row = data.rows[0];
  if (!row) notFound();
  const [leads, requests, ents] = await Promise.all([
    apiFetch<LeadStatusRow[]>(`/leads?advisorId=${id}&pageSize=10`),
    apiFetch<RequestRow[]>(`/payouts/requests?advisorId=${id}&pageSize=20`),
    apiFetch<EntitlementDto[]>(`/payouts/entitlements?advisorId=${id}&pageSize=20`),
  ]);
  const p = row.payouts;
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/manager/advisors" className="text-muted-foreground text-sm hover:underline">
            ← Advisors
          </Link>
          <h1 className="text-2xl font-semibold">{row.user.fullName || '(onboarding)'}</h1>
          <p className="text-muted-foreground text-sm">
            {row.user.publicRef} · {row.user.mobileMasked ?? ''} · joined {formatDate(row.user.joinedAt)}
            {row.reporting ? ` · ${REPORTING_LABEL[row.reporting.source] ?? row.reporting.source}${row.reporting.agentCode ? ` ${row.reporting.agentCode}` : ''} since ${formatDate(row.reporting.since)}` : ''}
          </p>
        </div>
        <Badge variant={row.user.status === 'ACTIVE' ? 'success' : 'unknown'}>{row.user.status}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Leads created" m={row.leads.created} />
        <Tile label="Matched in bank MIS" m={row.leads.misMatched} />
        <Tile label="Eligible card events" m={p.eligible} money />
        <Tile label="Paid card events" m={p.paid} money />
        <Tile label="Available to claim" m={p.available} money />
        <Tile label="Requested" m={p.requested} money />
        <Tile label="Approved, unpaid" m={p.approvedUnpaid} money />
        <Tile label="On hold" m={p.onHold} money />
      </div>
      <p className="text-muted-foreground text-xs">
        {data.meta.note} Leads are dated by KBS lead creation; payout events by the MIS evidence that made them eligible. {row.awaitingManagerApproval ? `${row.awaitingManagerApproval} request(s) are waiting for a Manager decision.` : ''}
      </p>

      <div className="grid gap-3 lg:grid-cols-3">
        <Dist title="Current stage" d={row.stage} />
        <Dist title="Final decision" d={row.decision} />
        <Dist title="Card activation" d={row.activation} />
      </div>

      {row.bankReasons.top.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bank reasons</CardTitle>
            <CardDescription>
              {row.bankReasons.leadsWithReason.value} of {row.bankReasons.leadsWithReason.denominator?.value ?? 0} MIS-matched leads carry a bank remark or decline field (verbatim).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {row.bankReasons.top.map((r) => (
                <li key={r.value} className="flex justify-between gap-2">
                  <span className="min-w-0 break-words">{r.value}</span>
                  <span className="tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Recent leads</CardTitle>
            <CardDescription>
              Latest {leads.data.length} of {Number(leads.meta.total ?? leads.data.length)} · stage, decision and activation shown separately.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/manager/leads?advisorId=${id}`}>All leads with filters</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Bank / card</TableHead>
                <TableHead>Bank status (MIS)</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell data-label="Customer">
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/manager/leads/${l.id}`}>
                      {l.customer.name}
                    </Link>
                    <div className="text-muted-foreground font-mono text-xs">{l.kbsRef}</div>
                  </TableCell>
                  <TableCell data-label="Bank / card" className="text-xs">
                    {l.bank.displayName}
                    <div className="text-muted-foreground">{l.card.name}</div>
                  </TableCell>
                  <TableCell data-label="Bank status (MIS)">
                    <div className="flex flex-wrap gap-1">
                      <StageBadge field={l.stage} />
                      <DecisionBadge field={l.decision} />
                      <ActivationBadge field={l.activation} />
                    </div>
                    {l.remarksPreview ? <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{l.remarksPreview}</div> : null}
                  </TableCell>
                  <TableCell data-label="Created" className="text-xs">
                    {formatDate(l.leadCreatedAt)}
                  </TableCell>
                </TableRow>
              ))}
              {leads.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No leads yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payout requests</CardTitle>
            <CardDescription>Newest first. Open a request to see both approvals and the Accounts payment record.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table responsive>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell data-label="Request">
                      <Link className="font-mono text-xs underline-offset-2 hover:underline" href={`/manager/payouts/requests/${r.id}`}>
                        {r.publicRef}
                      </Link>
                      <div className="text-muted-foreground text-xs">submitted {formatDateTime(r.submittedAt)}</div>
                    </TableCell>
                    <TableCell data-label="Amount" className="text-xs">
                      {inr(r.totalAmountInr)}
                      <div className="text-muted-foreground">{r.itemCount} card event(s)</div>
                    </TableCell>
                    <TableCell data-label="State">
                      <PayoutStateBadge state={r.state} />
                      {r.outstanding.length ? <div className="text-muted-foreground text-xs">Waiting: {r.outstanding.join(' + ').toLowerCase()}</div> : null}
                      {r.paidAt ? <div className="text-muted-foreground text-xs">Paid {formatDate(r.paidAt)}</div> : null}
                    </TableCell>
                  </TableRow>
                ))}
                {requests.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      No payout requests yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Eligible card events</CardTitle>
            <CardDescription>Payout entitlements created from applied bank MIS under the approved rule. Paid events cannot be claimed again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table responsive>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>MIS evidence</TableHead>
                  <TableHead>Amount / state</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ents.data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell data-label="Lead">
                      <Link className="underline-offset-2 hover:underline" href={`/manager/leads/${e.lead.id}`}>
                        {e.lead.customerFullName}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {e.bank.displayName} · {e.card}
                      </div>
                    </TableCell>
                    <TableCell data-label="MIS evidence" className="text-xs">
                      <span className="font-mono">
                        {e.triggerField} = {e.triggerFieldValue}
                      </span>
                      <div className="text-muted-foreground">
                        batch {e.evidence.batchRef} · {formatDate(e.eligibleAt)}
                      </div>
                    </TableCell>
                    <TableCell data-label="Amount / state" className="text-xs">
                      {inr(e.amountInr)}
                      <div>
                        <Badge variant="secondary">{e.state.replaceAll('_', ' ').toLowerCase()}</Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {ents.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      No eligible card events yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
