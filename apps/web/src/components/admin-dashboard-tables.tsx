import { formatDateTime, formatInr } from '@kbs/shared';
import { CalendarRange, CreditCard, Filter, UserCog, UserRound, Users } from 'lucide-react';
import Link from 'next/link';

import { AdminDashboardNav } from '@/components/admin-dashboard-nav';
import { Button } from '@/components/ui/button';
import { Avatar, BankMark, EmptyState, humanize, Meter, MiniStat, selectClass, type Tone } from '@/components/ui/kit';
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
const pct = (m: M) => (m.denominator && m.denominator.value ? ` (${Math.round((m.value / m.denominator.value) * 100)}%)` : '');
const num = 'tabular-nums sm:text-right';
const total = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((n, r) => n + f(r), 0);

function qsOf(sp: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'managerId', 'bankId']) if (sp[k]) qs.set(k, sp[k] as string);
  return qs.toString();
}

/** Person cell: avatar, name link, optional KBS status underneath. */
function PersonCell({ name, href, status }: { name: string; href: string; status?: string }) {
  return (
    <div className="flex min-w-36 items-center gap-2.5">
      <Avatar name={name} size="sm" />
      <div className="min-w-0">
        <Link className="font-medium" href={href}>
          {name}
        </Link>
        {status ? <div className="text-[11px] text-slate-500">{humanize(status)}</div> : null}
      </div>
    </div>
  );
}

/** Count with its ₹ amount (payout events). */
function Money({ count, amount }: { count: number; amount: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-slate-900">{count}</span>
      <span className="text-slate-400"> · </span>
      <span className="text-slate-600">{formatInr(amount)}</span>
    </span>
  );
}

function Frame({
  path,
  title,
  sp,
  meta,
  stats,
  empty,
  children,
}: {
  path: string;
  title: string;
  sp: Record<string, string | undefined>;
  meta: Meta;
  stats?: { label: string; value: number; hint: string; tone?: Tone }[];
  /** rendered instead of the table when there are no rows */
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">{title}</h1>
      {stats?.length ? (
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((x) => (
            <MiniStat key={x.label} label={x.label} value={x.value} hint={x.hint} tone={x.tone ?? 'slate'} />
          ))}
        </div>
      ) : null}
      <section aria-label={title} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <AdminDashboardNav active={path} />
          <span className="text-xs text-slate-500 tabular-nums">
            <CalendarRange className="mr-1 inline size-3.5 -translate-y-px" aria-hidden="true" />
            {meta.from || meta.to ? `${meta.from ?? '…'} → ${meta.to ?? '…'}` : 'All time'} · as of {formatDateTime(meta.asOf)}
          </span>
        </div>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3" action={path}>
          <input aria-label="From date" className={`${selectClass} h-9 w-36`} type="date" name="from" defaultValue={sp.from ?? ''} />
          <input aria-label="To date" className={`${selectClass} h-9 w-36`} type="date" name="to" defaultValue={sp.to ?? ''} />
          <Button type="submit" size="sm" className="h-9">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={path}>Reset</Link>
          </Button>
        </form>
        <div className="min-h-0 flex-1">
          {empty ?? children}
        </div>
      </section>
    </div>
  );
}

export async function TelecallerPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { user: Person; records: Record<string, M>; calls: Record<string, M>; callbacks: Record<string, M>; shares: { total: M } }[]; meta: Meta }>(`/dashboards/admin/telecallers?${qsOf(sp)}`)).data;
  const hint = 'Total of the rows below';
  return (
    <Frame
      path="/admin/dashboards/telecallers"
      title="Telecaller performance"
      sp={sp}
      meta={d.meta}
      stats={[
        { label: 'Telecallers', value: d.rows.length, hint: 'In this view', tone: 'violet' },
        { label: 'Call attempts', value: total(d.rows, (r) => r.calls.attempts.value), hint, tone: 'sky' },
        { label: 'Connected', value: total(d.rows, (r) => r.calls.connected.value), hint, tone: 'emerald' },
        { label: 'Shares', value: total(d.rows, (r) => r.shares.total.value), hint, tone: 'teal' },
      ]}
      empty={d.rows.length === 0 ? <EmptyState icon={Users} title="No Telecallers." /> : undefined}
    >
      <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            <TableHead>Telecaller</TableHead>
            <TableHead className="sm:text-right">Records (assigned / active)</TableHead>
            <TableHead className="sm:text-right">Attempts</TableHead>
            <TableHead className="sm:text-right">Connected</TableHead>
            <TableHead className="sm:text-right">Not answered</TableHead>
            <TableHead className="sm:text-right">Unique contacted</TableHead>
            <TableHead className="sm:text-right">Recordings</TableHead>
            <TableHead className="sm:text-right">Callbacks due / done</TableHead>
            <TableHead className="sm:text-right">Shares</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell data-label="Telecaller">
                <PersonCell name={r.user.fullName} href={`/admin/calling-list/performance/telecaller/${r.user.id}`} status={r.user.status} />
              </TableCell>
              <TableCell data-label="Records" className={num}>
                {r.records.assigned.value} / {r.records.active.value}
              </TableCell>
              <TableCell data-label="Attempts" className={num}>
                {r.calls.attempts.value}
              </TableCell>
              <TableCell data-label="Connected" className={num}>
                <span className="font-medium text-slate-900">{r.calls.connected.value}</span>
                <span className="text-xs text-slate-500">{pct(r.calls.connected)}</span>
                {r.calls.connected.denominator?.value ? <Meter value={r.calls.connected.value} max={r.calls.connected.denominator.value} tone="emerald" className="mt-1 h-1 w-16 sm:ml-auto" label="Connected share of attempts" /> : null}
              </TableCell>
              <TableCell data-label="Not answered" className={num}>
                {r.calls.notAnswered.value}
              </TableCell>
              <TableCell data-label="Unique contacted" className={num}>
                {r.calls.uniqueCustomersContacted.value}
              </TableCell>
              <TableCell data-label="Recordings" className={num}>
                {r.calls.recordingsAvailable.value}
                <span className="text-xs text-slate-500">{pct(r.calls.recordingsAvailable)}</span>
              </TableCell>
              <TableCell data-label="Callbacks" className={num}>
                {r.callbacks.due.value} / {r.callbacks.completed.value}
              </TableCell>
              <TableCell data-label="Shares" className={num}>
                {r.shares.total.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  );
}

export async function ManagerPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { user: Person; telecallers: number; advisors: number; calls: Record<string, M>; shares: M; leads: Record<string, M>; payouts: Record<string, M> }[]; meta: Meta }>(`/dashboards/admin/managers?${qsOf(sp)}`)).data;
  const hint = 'Total of the rows below';
  return (
    <Frame
      path="/admin/dashboards/managers"
      title="Manager performance"
      sp={sp}
      meta={d.meta}
      stats={[
        { label: 'Managers', value: d.rows.length, hint: 'In this view', tone: 'violet' },
        { label: 'Telecallers', value: total(d.rows, (r) => r.telecallers), hint, tone: 'sky' },
        { label: 'Advisors', value: total(d.rows, (r) => r.advisors), hint, tone: 'indigo' },
        { label: 'Leads created', value: total(d.rows, (r) => r.leads.created.value), hint, tone: 'teal' },
      ]}
      empty={d.rows.length === 0 ? <EmptyState icon={UserCog} title="No Managers." /> : undefined}
    >
      <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            <TableHead>Manager</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="sm:text-right">Attempts / connected</TableHead>
            <TableHead className="sm:text-right">Shares</TableHead>
            <TableHead className="sm:text-right">Leads / MIS matched</TableHead>
            <TableHead className="sm:text-right">Payout eligible</TableHead>
            <TableHead className="sm:text-right">Approved unpaid</TableHead>
            <TableHead className="sm:text-right">Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell data-label="Manager">
                <PersonCell name={r.user.fullName} href={`/admin/dashboards/advisors?managerId=${r.user.id}`} />
              </TableCell>
              <TableCell data-label="Team" className="text-slate-600">
                <span className="tabular-nums">{r.telecallers}</span> Telecallers · <span className="tabular-nums">{r.advisors}</span> Advisors
              </TableCell>
              <TableCell data-label="Attempts / connected" className={num}>
                {r.calls.attempts.value} / {r.calls.connected.value}
              </TableCell>
              <TableCell data-label="Shares" className={num}>
                {r.shares.value}
              </TableCell>
              <TableCell data-label="Leads / matched" className={num}>
                {r.leads.created.value} / {r.leads.misMatched.value}
                {r.leads.created.value ? <Meter value={r.leads.misMatched.value} max={r.leads.created.value} tone="indigo" className="mt-1 h-1 w-16 sm:ml-auto" label="MIS matched share of leads" /> : null}
              </TableCell>
              <TableCell data-label="Payout eligible" className={num}>
                <Money count={r.payouts.eligible.value} amount={r.payouts.eligible.amountInr ?? 0} />
              </TableCell>
              <TableCell data-label="Approved unpaid" className={num}>
                <Money count={r.payouts.approvedUnpaid.value} amount={r.payouts.approvedUnpaid.amountInr ?? 0} />
              </TableCell>
              <TableCell data-label="Paid" className={num}>
                <Money count={r.payouts.paid.value} amount={r.payouts.paid.amountInr ?? 0} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  );
}

/** Top bank values with counts — verbatim text, neutral chips (never recoloured). */
function TopValues({ x }: { x: Dist }) {
  const top = x.buckets.slice(0, 3);
  if (!top.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {top.map((b) => (
        <span key={b.value} className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11.5px] text-slate-700 ring-1 ring-slate-200 ring-inset">
          <span className="min-w-0 break-words">{b.value}</span>
          <span className="font-semibold text-slate-900 tabular-nums">{b.count}</span>
        </span>
      ))}
    </div>
  );
}

export async function AdvisorPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { user: Person; leads: Record<string, M>; decision: Dist; activation: Dist; payouts: Record<string, M> }[]; meta: Meta }>(`/dashboards/admin/advisors?${qsOf(sp)}`)).data;
  const hint = 'Total of the rows below';
  return (
    <Frame
      path="/admin/dashboards/advisors"
      title="Advisor performance"
      sp={sp}
      meta={d.meta}
      stats={[
        { label: 'Advisors', value: d.rows.length, hint: 'In this view', tone: 'violet' },
        { label: 'Leads created', value: total(d.rows, (r) => r.leads.created.value), hint, tone: 'teal' },
        { label: 'MIS matched', value: total(d.rows, (r) => r.leads.misMatched.value), hint, tone: 'indigo' },
        { label: 'Paid payout events', value: total(d.rows, (r) => r.payouts.paid.value), hint: `${formatInr(total(d.rows, (r) => r.payouts.paid.amountInr ?? 0))} · ${hint.toLowerCase()}`, tone: 'emerald' },
      ]}
      empty={d.rows.length === 0 ? <EmptyState icon={UserRound} title="No Advisors." /> : undefined}
    >
      <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            <TableHead>Advisor</TableHead>
            <TableHead className="sm:text-right">Leads / matched</TableHead>
            <TableHead>Final decision</TableHead>
            <TableHead>Card activation</TableHead>
            <TableHead className="sm:text-right">Eligible</TableHead>
            <TableHead className="sm:text-right">Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell data-label="Advisor">
                <PersonCell name={r.user.fullName} href={`/admin/leads?advisorId=${r.user.id}`} status={r.user.status} />
              </TableCell>
              <TableCell data-label="Leads / matched" className={num}>
                {r.leads.created.value} / {r.leads.misMatched.value}
                {r.leads.created.value ? <Meter value={r.leads.misMatched.value} max={r.leads.created.value} tone="indigo" className="mt-1 h-1 w-16 sm:ml-auto" label="MIS matched share of leads" /> : null}
              </TableCell>
              <TableCell data-label="Final decision">
                <TopValues x={r.decision} />
              </TableCell>
              <TableCell data-label="Card activation">
                <TopValues x={r.activation} />
              </TableCell>
              <TableCell data-label="Eligible" className={num}>
                <Money count={r.payouts.eligible.value} amount={r.payouts.eligible.amountInr ?? 0} />
              </TableCell>
              <TableCell data-label="Paid" className={num}>
                <Money count={r.payouts.paid.value} amount={r.payouts.paid.amountInr ?? 0} />
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
  const hint = 'Total of the rows below';
  return (
    <Frame
      path="/admin/dashboards/bank-card-mix"
      title="Bank / card mix"
      sp={sp}
      meta={d.meta}
      stats={[
        { label: 'Leads', value: total(d.rows, (r) => r.leads), hint, tone: 'teal' },
        { label: 'MIS matched', value: total(d.rows, (r) => r.misMatched), hint, tone: 'indigo' },
        { label: 'Awaiting MIS', value: total(d.rows, (r) => r.awaitingMis), hint, tone: 'slate' },
        { label: 'Payout eligible', value: total(d.rows, (r) => r.payoutEligible.count), hint: `${formatInr(total(d.rows, (r) => r.payoutEligible.amountInr))} · ${hint.toLowerCase()}`, tone: 'emerald' },
      ]}
      empty={d.rows.length === 0 ? <EmptyState icon={CreditCard} title="No leads in this period." /> : undefined}
    >
      <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            <TableHead>Bank</TableHead>
            <TableHead>Card</TableHead>
            <TableHead className="sm:text-right">Leads</TableHead>
            <TableHead className="sm:text-right">MIS matched</TableHead>
            <TableHead className="sm:text-right">Awaiting MIS</TableHead>
            <TableHead className="sm:text-right">Payout eligible</TableHead>
            <TableHead className="sm:text-right">Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.rows.map((r) => (
            <TableRow key={`${r.bank.code}:${r.card.id}`}>
              <TableCell data-label="Bank">
                <div className="flex items-center gap-2.5">
                  <BankMark code={r.bank.code} size="sm" />
                  <span className="font-medium text-slate-800">{r.bank.displayName}</span>
                </div>
              </TableCell>
              <TableCell data-label="Card">{r.card.name}</TableCell>
              <TableCell data-label="Leads" className={num}>
                {r.leads}
              </TableCell>
              <TableCell data-label="MIS matched" className={num}>
                {r.misMatched}
                {r.leads ? <Meter value={r.misMatched} max={r.leads} tone="indigo" className="mt-1 h-1 w-16 sm:ml-auto" label="MIS matched share of leads" /> : null}
              </TableCell>
              <TableCell data-label="Awaiting MIS" className={num}>
                {r.awaitingMis}
              </TableCell>
              <TableCell data-label="Payout eligible" className={num}>
                <Money count={r.payoutEligible.count} amount={r.payoutEligible.amountInr} />
              </TableCell>
              <TableCell data-label="Paid" className={num}>
                <Money count={r.payoutPaid.count} amount={r.payoutPaid.amountInr} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  );
}
