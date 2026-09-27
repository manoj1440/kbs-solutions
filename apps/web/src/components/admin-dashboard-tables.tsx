import { formatDateTime, formatInr } from '@kbs/shared';
import { CalendarRange, Clock, CreditCard, Filter, Landmark, PhoneCall, Scale, Share2, UserCog, UserRound, Users, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { AdminDashboardNav } from '@/components/admin-dashboard-nav';
import { Button } from '@/components/ui/button';
import { Avatar, BankMark, EmptyState, Field, humanize, Meter, PageHeader, SectionCard, selectClass, StatCard, StatGrid } from '@/components/ui/kit';
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
  description,
  icon,
  sp,
  meta,
  stats,
  empty,
  children,
}: {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  sp: Record<string, string | undefined>;
  meta: Meta;
  stats?: React.ReactNode;
  /** rendered instead of the table when there are no rows */
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={icon}
        eyebrow="Reports"
        title={title}
        description={`${description} ${meta.note}`}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="size-3.5" aria-hidden="true" />
              {meta.from || meta.to ? `${meta.from ?? '…'} → ${meta.to ?? '…'}` : 'All time'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden="true" />
              as of {formatDateTime(meta.asOf)}
            </span>
          </>
        }
      />
      <AdminDashboardNav active={path} />
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]" action={path}>
        <Field label="From" htmlFor="dash-from" className="min-w-36 flex-1 sm:max-w-52">
          <input id="dash-from" className={selectClass} type="date" name="from" defaultValue={sp.from ?? ''} />
        </Field>
        <Field label="To" htmlFor="dash-to" className="min-w-36 flex-1 sm:max-w-52">
          <input id="dash-to" className={selectClass} type="date" name="to" defaultValue={sp.to ?? ''} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" className="h-10">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="outline" className="h-10">
            <Link href={path}>Reset</Link>
          </Button>
        </div>
      </form>
      {stats ? <StatGrid>{stats}</StatGrid> : null}
      <SectionCard icon={Scale} tone="slate" title="Evidence, not ranking" description="Figures per person with their own source; no score or automatic decision is derived from them (REQ-15 §15.3)." flush={!empty}>
        {empty ?? children}
      </SectionCard>
    </div>
  );
}

export async function TelecallerPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: { user: Person; records: Record<string, M>; calls: Record<string, M>; callbacks: Record<string, M>; shares: { total: M } }[]; meta: Meta }>(`/dashboards/admin/telecallers?${qsOf(sp)}`)).data;
  const hint = 'Total of the rows below';
  return (
    <Frame
      path="/admin/dashboards/telecallers"
      icon={Users}
      title="Telecaller performance"
      description="Provider-confirmed calls, KBS outcomes and shares per Telecaller · call initiated date."
      sp={sp}
      meta={d.meta}
      stats={
        <>
          <StatCard label="Telecallers" value={d.rows.length} hint="In this view" icon={Users} tone="violet" />
          <StatCard label="Call attempts" value={total(d.rows, (r) => r.calls.attempts.value)} hint={hint} icon={PhoneCall} tone="sky" />
          <StatCard label="Connected" value={total(d.rows, (r) => r.calls.connected.value)} hint={hint} icon={PhoneCall} tone="emerald" />
          <StatCard label="Shares" value={total(d.rows, (r) => r.shares.total.value)} hint={hint} icon={Share2} tone="teal" />
        </>
      }
      empty={d.rows.length === 0 ? <EmptyState icon={Users} title="No Telecallers." /> : undefined}
    >
      <Table responsive>
        <TableHeader>
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
                <PersonCell name={r.user.fullName} href={`/admin?period=all&telecallerId=${r.user.id}`} status={r.user.status} />
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
      icon={UserCog}
      title="Manager performance"
      description="Team totals per Manager — identical to what each Manager sees on their own dashboard."
      sp={sp}
      meta={d.meta}
      stats={
        <>
          <StatCard label="Managers" value={d.rows.length} hint="In this view" icon={UserCog} tone="violet" />
          <StatCard label="Telecallers" value={total(d.rows, (r) => r.telecallers)} hint={hint} icon={PhoneCall} tone="sky" />
          <StatCard label="Advisors" value={total(d.rows, (r) => r.advisors)} hint={hint} icon={UserRound} tone="indigo" />
          <StatCard label="Leads created" value={total(d.rows, (r) => r.leads.created.value)} hint={hint} icon={Landmark} tone="teal" />
        </>
      }
      empty={d.rows.length === 0 ? <EmptyState icon={UserCog} title="No Managers." /> : undefined}
    >
      <Table responsive>
        <TableHeader>
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
                <PersonCell name={r.user.fullName} href={`/admin?period=all&managerId=${r.user.id}`} />
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
      icon={UserRound}
      title="Advisor performance"
      description="Leads, latest accepted MIS results (verbatim) and payout events per Advisor · KBS lead created date."
      sp={sp}
      meta={d.meta}
      stats={
        <>
          <StatCard label="Advisors" value={d.rows.length} hint="In this view" icon={UserRound} tone="violet" />
          <StatCard label="Leads created" value={total(d.rows, (r) => r.leads.created.value)} hint={hint} icon={Landmark} tone="teal" />
          <StatCard label="MIS matched" value={total(d.rows, (r) => r.leads.misMatched.value)} hint={hint} icon={Landmark} tone="indigo" />
          <StatCard label="Paid payout events" value={total(d.rows, (r) => r.payouts.paid.value)} hint={`${formatInr(total(d.rows, (r) => r.payouts.paid.amountInr ?? 0))} · ${hint.toLowerCase()}`} icon={Wallet} tone="emerald" />
        </>
      }
      empty={d.rows.length === 0 ? <EmptyState icon={UserRound} title="No Advisors." /> : undefined}
    >
      <Table responsive>
        <TableHeader>
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
      icon={CreditCard}
      title="Bank / card mix"
      description={`${d.meta.source} · KBS lead created date.`}
      sp={sp}
      meta={d.meta}
      stats={
        <>
          <StatCard label="Leads" value={total(d.rows, (r) => r.leads)} hint={hint} icon={Landmark} tone="teal" />
          <StatCard label="MIS matched" value={total(d.rows, (r) => r.misMatched)} hint={hint} icon={Landmark} tone="indigo" />
          <StatCard label="Awaiting MIS" value={total(d.rows, (r) => r.awaitingMis)} hint={hint} icon={Clock} tone="slate" />
          <StatCard label="Payout eligible" value={total(d.rows, (r) => r.payoutEligible.count)} hint={`${formatInr(total(d.rows, (r) => r.payoutEligible.amountInr))} · ${hint.toLowerCase()}`} icon={Wallet} tone="emerald" />
        </>
      }
      empty={d.rows.length === 0 ? <EmptyState icon={CreditCard} title="No leads in this period." /> : undefined}
    >
      <Table responsive>
        <TableHeader>
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
