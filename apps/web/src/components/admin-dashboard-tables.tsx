import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

import { AdminDashboardNav } from '@/components/admin-dashboard-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface M {
  value: number;
  amountInr?: number;
  denominator?: { label: string; value: number };
}
interface Dist {
  buckets: { value: string; count: number }[];
}
interface Person {
  id: string;
  fullName: string;
  publicRef: string;
  status: string;
}
interface Meta {
  from: string | null;
  to: string | null;
  asOf: string;
  note: string;
}
const sel = 'border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm';
const pct = (m: M) => (m.denominator && m.denominator.value ? ` (${Math.round((m.value / m.denominator.value) * 100)}%)` : '');

function qsOf(sp: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'managerId', 'bankId']) if (sp[k]) qs.set(k, sp[k] as string);
  return qs.toString();
}

function Frame({ path, title, description, sp, meta, children }: { path: string; title: string; description: string; sp: Record<string, string | undefined>; meta: Meta; children: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <AdminDashboardNav active={path} />
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">
          {description} {meta.from || meta.to ? `${meta.from ?? '…'} → ${meta.to ?? '…'}` : 'All time'} · as of {formatDateTime(meta.asOf)}. {meta.note}
        </p>
      </div>
      <form className="grid items-end gap-2 sm:grid-cols-4" action={path}>
        <label className="grid gap-1 text-xs">
          From
          <input className={sel} type="date" name="from" defaultValue={sp.from ?? ''} />
        </label>
        <label className="grid gap-1 text-xs">
          To
          <input className={sel} type="date" name="to" defaultValue={sp.to ?? ''} />
        </label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href={path}>Reset</Link>
          </Button>
        </div>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Evidence, not ranking</CardTitle>
          <CardDescription>Figures per person with their own source; no score or automatic decision is derived from them (REQ-15 §15.3).</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

export async function TelecallerPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { user: Person; records: Record<string, M>; calls: Record<string, M>; callbacks: Record<string, M>; shares: { total: M } }[]; meta: Meta }>(`/dashboards/admin/telecallers?${qsOf(sp)}`)).data;
  return (
    <Frame path="/admin/dashboards/telecallers" title="Telecaller performance" description="Provider-confirmed calls, KBS outcomes and shares per Telecaller · call initiated date." sp={sp} meta={d.meta}>
      <Table responsive>
        <TableHeader>
          <TableRow>
            <TableHead>Telecaller</TableHead>
            <TableHead>Records (assigned / active)</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Connected</TableHead>
            <TableHead>Not answered</TableHead>
            <TableHead>Unique contacted</TableHead>
            <TableHead>Recordings</TableHead>
            <TableHead>Callbacks due / done</TableHead>
            <TableHead>Shares</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground text-center">
                No Telecallers.
              </TableCell>
            </TableRow>
          ) : null}
          {d.rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell data-label="Telecaller">
                <Link className="underline" href={`/admin/dashboards?telecallerId=${r.user.id}`}>
                  {r.user.fullName}
                </Link>
                <div className="text-muted-foreground text-xs">{r.user.status.toLowerCase()}</div>
              </TableCell>
              <TableCell data-label="Records">
                {r.records.assigned.value} / {r.records.active.value}
              </TableCell>
              <TableCell data-label="Attempts">{r.calls.attempts.value}</TableCell>
              <TableCell data-label="Connected">
                {r.calls.connected.value}
                <span className="text-muted-foreground text-xs">{pct(r.calls.connected)}</span>
              </TableCell>
              <TableCell data-label="Not answered">{r.calls.notAnswered.value}</TableCell>
              <TableCell data-label="Unique contacted">{r.calls.uniqueCustomersContacted.value}</TableCell>
              <TableCell data-label="Recordings">
                {r.calls.recordingsAvailable.value}
                <span className="text-muted-foreground text-xs">{pct(r.calls.recordingsAvailable)}</span>
              </TableCell>
              <TableCell data-label="Callbacks">
                {r.callbacks.due.value} / {r.callbacks.completed.value}
              </TableCell>
              <TableCell data-label="Shares">{r.shares.total.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  );
}

export async function ManagerPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { user: Person; telecallers: number; advisors: number; calls: Record<string, M>; shares: M; leads: Record<string, M>; payouts: Record<string, M> }[]; meta: Meta }>(`/dashboards/admin/managers?${qsOf(sp)}`)).data;
  return (
    <Frame path="/admin/dashboards/managers" title="Manager performance" description="Team totals per Manager — identical to what each Manager sees on their own dashboard." sp={sp} meta={d.meta}>
      <Table responsive>
        <TableHeader>
          <TableRow>
            <TableHead>Manager</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Attempts / connected</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Leads / MIS matched</TableHead>
            <TableHead>Payout eligible</TableHead>
            <TableHead>Approved unpaid</TableHead>
            <TableHead>Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell data-label="Manager">
                <Link className="underline" href={`/admin/dashboards?managerId=${r.user.id}`}>
                  {r.user.fullName}
                </Link>
              </TableCell>
              <TableCell data-label="Team">
                {r.telecallers} Telecallers · {r.advisors} Advisors
              </TableCell>
              <TableCell data-label="Attempts / connected">
                {r.calls.attempts.value} / {r.calls.connected.value}
              </TableCell>
              <TableCell data-label="Shares">{r.shares.value}</TableCell>
              <TableCell data-label="Leads / matched">
                {r.leads.created.value} / {r.leads.misMatched.value}
              </TableCell>
              <TableCell data-label="Payout eligible" className="whitespace-nowrap">
                {r.payouts.eligible.value} · {formatInr(r.payouts.eligible.amountInr ?? 0)}
              </TableCell>
              <TableCell data-label="Approved unpaid" className="whitespace-nowrap">
                {r.payouts.approvedUnpaid.value} · {formatInr(r.payouts.approvedUnpaid.amountInr ?? 0)}
              </TableCell>
              <TableCell data-label="Paid" className="whitespace-nowrap">
                {r.payouts.paid.value} · {formatInr(r.payouts.paid.amountInr ?? 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  );
}

export async function AdvisorPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { user: Person; leads: Record<string, M>; decision: Dist; activation: Dist; payouts: Record<string, M> }[]; meta: Meta }>(`/dashboards/admin/advisors?${qsOf(sp)}`)).data;
  const top = (x: Dist) =>
    x.buckets
      .slice(0, 3)
      .map((b) => `${b.value} ${b.count}`)
      .join(' · ') || '—';
  return (
    <Frame path="/admin/dashboards/advisors" title="Advisor performance" description="Leads, latest accepted MIS results (verbatim) and payout events per Advisor · KBS lead created date." sp={sp} meta={d.meta}>
      <Table responsive>
        <TableHeader>
          <TableRow>
            <TableHead>Advisor</TableHead>
            <TableHead>Leads / matched</TableHead>
            <TableHead>Final decision</TableHead>
            <TableHead>Card activation</TableHead>
            <TableHead>Eligible</TableHead>
            <TableHead>Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell data-label="Advisor">
                <Link className="underline" href={`/admin/leads?advisorId=${r.user.id}`}>
                  {r.user.fullName}
                </Link>
                <div className="text-muted-foreground text-xs">{r.user.status.toLowerCase().replace(/_/g, ' ')}</div>
              </TableCell>
              <TableCell data-label="Leads / matched">
                {r.leads.created.value} / {r.leads.misMatched.value}
              </TableCell>
              <TableCell data-label="Final decision" className="text-xs whitespace-normal">
                {top(r.decision)}
              </TableCell>
              <TableCell data-label="Card activation" className="text-xs whitespace-normal">
                {top(r.activation)}
              </TableCell>
              <TableCell data-label="Eligible" className="whitespace-nowrap">
                {r.payouts.eligible.value} · {formatInr(r.payouts.eligible.amountInr ?? 0)}
              </TableCell>
              <TableCell data-label="Paid" className="whitespace-nowrap">
                {r.payouts.paid.value} · {formatInr(r.payouts.paid.amountInr ?? 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  );
}

export async function BankCardMix({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { bank: { code: string; displayName: string }; card: { id: string; name: string }; leads: number; misMatched: number; awaitingMis: number; payoutEligible: { count: number; amountInr: number }; payoutPaid: { count: number; amountInr: number } }[]; meta: Meta & { source: string } }>(`/dashboards/admin/bank-card-mix?${qsOf(sp)}`)).data;
  return (
    <Frame path="/admin/dashboards/bank-card-mix" title="Bank / card mix" description={`${d.meta.source} · KBS lead created date.`} sp={sp} meta={d.meta}>
      <Table responsive>
        <TableHeader>
          <TableRow>
            <TableHead>Bank</TableHead>
            <TableHead>Card</TableHead>
            <TableHead>Leads</TableHead>
            <TableHead>MIS matched</TableHead>
            <TableHead>Awaiting MIS</TableHead>
            <TableHead>Payout eligible</TableHead>
            <TableHead>Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground text-center">
                No leads in this period.
              </TableCell>
            </TableRow>
          ) : null}
          {d.rows.map((r) => (
            <TableRow key={`${r.bank.code}:${r.card.id}`}>
              <TableCell data-label="Bank">{r.bank.displayName}</TableCell>
              <TableCell data-label="Card">{r.card.name}</TableCell>
              <TableCell data-label="Leads">{r.leads}</TableCell>
              <TableCell data-label="MIS matched">{r.misMatched}</TableCell>
              <TableCell data-label="Awaiting MIS">{r.awaitingMis}</TableCell>
              <TableCell data-label="Payout eligible" className="whitespace-nowrap">
                {r.payoutEligible.count} · {formatInr(r.payoutEligible.amountInr)}
              </TableCell>
              <TableCell data-label="Paid" className="whitespace-nowrap">
                {r.payoutPaid.count} · {formatInr(r.payoutPaid.amountInr)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  );
}
