import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

interface Metric {
  value: number;
  amountInr?: number;
  denominator?: { label: string; value: number };
  source: string;
  dateBasis: string;
}
interface Dist {
  source: string;
  dateBasis: string;
  buckets: { value: string; count: number }[];
  denominator: { label: string; value: number };
}
export interface OpsDashboard {
  scope: string;
  calling: {
    records: Record<'uploaded' | 'assigned' | 'active' | 'hidden', Metric>;
    calls: Record<'attempts' | 'failedBeforeProvider' | 'connected' | 'notAnswered' | 'failed' | 'uniqueCustomersContacted' | 'recordingsAvailable', Metric>;
    callbacks: Record<'due' | 'completed', Metric>;
    outcomes: Record<string, Metric>;
    shares: { total: Metric; delivered: Metric; byKind: Record<string, Metric> };
  };
  advisors: {
    leads: Record<'created' | 'misMatched' | 'awaitingMis', Metric>;
    stage: Dist;
    decision: Dist;
    activation: Dist;
    bankReasons: { leadsWithReason: Metric; top: { value: string; count: number }[] };
    payouts: Record<'eligible' | 'available' | 'requested' | 'approvedUnpaid' | 'onHold' | 'paid' | 'confirmedTransfersInr', Metric>;
  };
  alerts?: { kind: string; count: number; message: string; href: string }[];
  meta: { from: string | null; to: string | null; misFreshness: { bank: { code: string; displayName: string }; lastAppliedAt: string | null }[]; asOf: string; note: string };
}
interface UserRow {
  id: string;
  fullName: string;
  role: string;
}
interface Bank {
  id: string;
  displayName: string;
}

const SOURCE_LABEL: Record<string, string> = { KBS_CALLING: 'KBS calling', TELEPHONY_PROVIDER: 'Telephony provider', KBS_SHARING: 'KBS share log', KBS_LEADS: 'KBS leads', BANK_MIS: 'Bank MIS', KBS_PAYOUT_LEDGER: 'Payout ledger', ACCOUNTS_PAYMENT: 'Accounts payment' };
const OUTCOME_LABEL: Record<string, string> = { NO_ANSWER_OR_FAILED: 'No answer / failed', CONNECTED_INTERESTED: 'Connected – interested', CONNECTED_LINK_OR_PDF_SHARED: 'Connected – link/PDF shared', FOLLOW_UP: 'Follow-up', DECLINED: 'Declined', COMPLETED_NO_FURTHER: 'Completed' };
const SHARE_LABEL: Record<string, string> = { APPLICATION_LINK: 'Application links', BENEFIT_PDF: 'Benefit PDFs', OFFICE_ID: 'Official IDs' };
const sel = 'border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm';

function Tile({ label, m, money }: { label: string; m: Metric; money?: boolean }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-xl font-semibold">
        {m.value}
        {money && m.amountInr !== undefined ? <span className="text-muted-foreground ml-2 text-sm font-normal">{formatInr(m.amountInr)}</span> : null}
      </div>
      <div className="text-muted-foreground text-[11px] leading-tight">
        {m.denominator ? `of ${m.denominator.value} ${m.denominator.label} · ` : ''}
        {SOURCE_LABEL[m.source] ?? m.source} · {m.dateBasis}
      </div>
    </div>
  );
}

function DistCard({ title, d }: { title: string; d: Dist }) {
  const max = Math.max(1, ...d.buckets.map((b) => b.count));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          Latest accepted MIS value, verbatim · {d.denominator.value} {d.denominator.label} · {d.dateBasis}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        {d.buckets.length === 0 ? <p className="text-muted-foreground text-sm">No leads in this population.</p> : null}
        {d.buckets.map((b) => (
          <div key={b.value} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
            <div className="min-w-0">
              <div className="truncate" title={b.value}>
                {b.value === 'Awaiting MIS' || b.value === 'Not reported' ? <em className="text-muted-foreground">{b.value}</em> : b.value}
              </div>
              <div className="bg-muted mt-0.5 h-1.5 rounded-full">
                <div className={`h-1.5 rounded-full ${b.value === 'Awaiting MIS' || b.value === 'Not reported' ? 'bg-slate-400' : 'bg-teal-600'}`} style={{ width: `${(b.count / max) * 100}%` }} />
              </div>
            </div>
            <span className="tabular-nums">{b.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * F-702 (and F-703 executive) operations dashboard. Calls, shares, leads, bank values and payouts are separate
 * metrics, each labelled with its source and date basis; bank values are the latest accepted MIS, never live status.
 */
export async function OperationsDashboard({ basePath, sp, title, endpoint, extra }: { basePath: string; sp: Record<string, string | undefined>; title: string; endpoint: string; extra?: React.ReactNode }) {
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'managerId', 'telecallerId', 'advisorId', 'bankId', 'cardId', 'pincode', 'state', 'misRecency']) if (sp[k]) qs.set(k, sp[k] as string);
  const [d, users, banks] = await Promise.all([
    apiFetch<OpsDashboard>(`${endpoint}?${qs.toString()}`).then((r) => r.data),
    apiFetch<UserRow[]>('/users?pageSize=200').then((r) => r.data).catch(() => [] as UserRow[]),
    apiFetch<Bank[]>('/catalogue/banks').then((r) => r.data).catch(() => [] as Bank[]),
  ]);
  const c = d.calling;
  const a = d.advisors;
  const telecallers = users.filter((u) => u.role === 'TELECALLER');
  const advisors = users.filter((u) => u.role === 'ADVISOR');
  const managers = users.filter((u) => u.role === 'MANAGER');
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">
          {d.scope} · {d.meta.from || d.meta.to ? `${d.meta.from ?? '…'} → ${d.meta.to ?? '…'}` : 'all time'} · as of {formatDateTime(d.meta.asOf)}. {d.meta.note}
        </p>
      </div>
      <form className="grid items-end gap-2 sm:grid-cols-3 lg:grid-cols-6" action={basePath}>
        <label className="grid gap-1 text-xs">
          From
          <input className={sel} type="date" name="from" defaultValue={sp.from ?? ''} />
        </label>
        <label className="grid gap-1 text-xs">
          To
          <input className={sel} type="date" name="to" defaultValue={sp.to ?? ''} />
        </label>
        {managers.length ? (
          <label className="grid gap-1 text-xs">
            Manager
            <select className={sel} name="managerId" defaultValue={sp.managerId ?? ''}>
              <option value="">All</option>
              {managers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="grid gap-1 text-xs">
          Telecaller
          <select className={sel} name="telecallerId" defaultValue={sp.telecallerId ?? ''}>
            <option value="">All</option>
            {telecallers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Advisor
          <select className={sel} name="advisorId" defaultValue={sp.advisorId ?? ''}>
            <option value="">All</option>
            {advisors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Bank
          <select className={sel} name="bankId" defaultValue={sp.bankId ?? ''}>
            <option value="">All</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Pincode
          <input className={sel} name="pincode" inputMode="numeric" maxLength={6} pattern="\d{6}" defaultValue={sp.pincode ?? ''} placeholder="6 digits" />
        </label>
        <label className="grid gap-1 text-xs">
          State
          <input className={sel} name="state" defaultValue={sp.state ?? ''} placeholder="e.g. Rajasthan" />
        </label>
        <label className="grid gap-1 text-xs">
          MIS recency
          <select className={sel} name="misRecency" defaultValue={sp.misRecency ?? ''}>
            <option value="">Any</option>
            <option value="within7">Matched in last 7 days</option>
            <option value="within30">Matched in last 30 days</option>
            <option value="older30">Last match older than 30 days</option>
            <option value="never">Never matched</option>
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href={basePath}>Reset</Link>
          </Button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2 text-xs" aria-label="MIS freshness per bank">
        {d.meta.misFreshness.map((f) => (
          <Badge key={f.bank.code} variant={f.lastAppliedAt ? 'info' : 'unknown'}>
            {f.bank.displayName}: {f.lastAppliedAt ? `MIS applied ${formatDateTime(f.lastAppliedAt)}` : 'no MIS applied'}
          </Badge>
        ))}
      </div>
      {d.alerts?.length ? (
        <div role="alert" className="grid gap-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Needs attention</strong>
          {d.alerts.map((al) => (
            <Link key={al.kind} href={al.href} className="underline underline-offset-2">
              {al.message}
            </Link>
          ))}
        </div>
      ) : null}
      {extra}
      <section className="grid gap-3" aria-labelledby="calling-h">
        <h2 id="calling-h" className="text-lg font-semibold">
          Calling operations
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Customer records uploaded" m={c.records.uploaded} />
          <Tile label="Assigned" m={c.records.assigned} />
          <Tile label="Active" m={c.records.active} />
          <Tile label="Hidden" m={c.records.hidden} />
          <Tile label="Call attempts (provider-confirmed)" m={c.calls.attempts} />
          <Tile label="Failed before provider" m={c.calls.failedBeforeProvider} />
          <Tile label="Connected calls" m={c.calls.connected} />
          <Tile label="Not answered" m={c.calls.notAnswered} />
          <Tile label="Failed (provider)" m={c.calls.failed} />
          <Tile label="Unique customers contacted" m={c.calls.uniqueCustomersContacted} />
          <Tile label="Recordings available" m={c.calls.recordingsAvailable} />
          <Tile label="Callbacks due (open)" m={c.callbacks.due} />
          <Tile label="Callbacks completed" m={c.callbacks.completed} />
          <Tile label="Shares recorded" m={c.shares.total} />
          <Tile label="Shares delivered (status known)" m={c.shares.delivered} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Customer-interest outcomes</CardTitle>
              <CardDescription>Recorded by Telecallers · outcome recorded date. An outcome is not a bank application.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              {Object.keys(c.outcomes).length === 0 ? <p className="text-muted-foreground">No outcomes recorded.</p> : null}
              {Object.entries(c.outcomes).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span>{OUTCOME_LABEL[k] ?? k}</span>
                  <span className="tabular-nums">{v.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Shares by kind</CardTitle>
              <CardDescription>Distinct recorded share actions · share recorded date.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              {Object.keys(c.shares.byKind).length === 0 ? <p className="text-muted-foreground">No shares recorded.</p> : null}
              {Object.entries(c.shares.byKind).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span>{SHARE_LABEL[k] ?? k}</span>
                  <span className="tabular-nums">{v.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
      <section className="grid gap-3" aria-labelledby="adv-h">
        <h2 id="adv-h" className="text-lg font-semibold">
          Advisor leads & bank results
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Tile label="Leads created" m={a.leads.created} />
          <Tile label="Matched in bank MIS" m={a.leads.misMatched} />
          <Tile label="Awaiting MIS" m={a.leads.awaitingMis} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <DistCard title="Current stage" d={a.stage} />
          <DistCard title="Final decision" d={a.decision} />
          <DistCard title="Card activation (distinct values)" d={a.activation} />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actionable bank reasons</CardTitle>
            <CardDescription>
              {a.bankReasons.leadsWithReason.value} of {a.bankReasons.leadsWithReason.denominator?.value ?? 0} MIS-matched leads carry a bank remark or decline field (verbatim).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {a.bankReasons.top.length === 0 ? <p className="text-muted-foreground">No bank reasons reported.</p> : null}
            {a.bankReasons.top.map((r) => (
              <div key={r.value} className="flex justify-between gap-2">
                <span className="min-w-0 truncate" title={r.value}>
                  {r.value}
                </span>
                <span className="tabular-nums">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <h3 className="font-semibold">Payout card events</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Eligible" m={a.payouts.eligible} money />
          <Tile label="Available to claim" m={a.payouts.available} money />
          <Tile label="Requested" m={a.payouts.requested} money />
          <Tile label="Approved, unpaid" m={a.payouts.approvedUnpaid} money />
          <Tile label="On hold" m={a.payouts.onHold} money />
          <Tile label="Paid (events)" m={a.payouts.paid} money />
          <div className="grid gap-1 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Confirmed transfers</div>
            <div className="text-xl font-semibold">{formatInr(a.payouts.confirmedTransfersInr.amountInr ?? 0)}</div>
            <div className="text-muted-foreground text-[11px]">Accounts payment · {a.payouts.confirmedTransfersInr.dateBasis}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
