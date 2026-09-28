import { formatDateTime, formatInr } from '@kbs/shared';
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  Clock,
  Database,
  Filter,
  Landmark,
  MessageSquareText,
  MessageSquareWarning,
  PhoneCall,
  Share2,
  SlidersHorizontal,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BankMark, Callout, EmptyState, Field, IconTile, Meter, SectionCard, selectClass, TONE, type Tone } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

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

/** KPI tile: value first; the metric's own source and date basis always shown underneath (never dropped). */
function Tile({ label, m, money, tone = 'teal' }: { label: string; m: Metric; money?: boolean; tone?: Tone }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
      <div className="flex items-center gap-1.5 text-[12.5px] leading-snug font-medium text-slate-600">
        <span className={cn('size-1.5 shrink-0 rounded-full', TONE[tone].bar)} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{m.value}</span>
        {money && m.amountInr !== undefined ? <span className={cn('text-sm font-semibold tabular-nums', TONE[tone].text)}>{formatInr(m.amountInr)}</span> : null}
      </div>
      {m.denominator ? (
        <div className="mt-2">
          <Meter value={m.value} max={m.denominator.value} tone={tone} className="h-1.5" label={`${label} of ${m.denominator.label}`} />
          <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
            of {m.denominator.value} {m.denominator.label}
          </p>
        </div>
      ) : null}
      <div className="min-h-3 flex-1" />
      <p className="border-t border-slate-100 pt-2 text-[10.5px] leading-snug text-slate-400">
        {SOURCE_LABEL[m.source] ?? m.source} · {m.dateBasis}
      </p>
    </div>
  );
}

function TileGroup({ icon, tone, title, children }: { icon: LucideIcon; tone: Tone; title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2.5">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
        <IconTile icon={icon} tone={tone} size="sm" className="size-6 rounded-lg [&>svg]:size-3.5" />
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function SectionHeading({ id, icon, tone, title, description }: { id: string; icon: LucideIcon; tone: Tone; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="text-[12.5px] leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

const MUTED = new Set(['Awaiting MIS', 'Not reported']);

/** Horizontal bars with counts; labels are shown exactly as given (bank values verbatim). */
function Bars({ rows, max, tone, empty, emptyIcon }: { rows: { key: string; label: string; count: number }[]; max?: number; tone: Tone; empty: string; emptyIcon: LucideIcon }) {
  if (rows.length === 0) return <EmptyState icon={emptyIcon} title={empty} className="py-6" />;
  const top = Math.max(1, max ?? 0, ...rows.map((r) => r.count));
  return (
    <ul className="grid gap-3">
      {rows.map((r) => {
        const muted = MUTED.has(r.label);
        return (
          <li key={r.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className={cn('min-w-0 truncate', muted ? 'text-slate-500 italic' : 'text-slate-800')} title={r.label}>
                {r.label}
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">{r.count}</span>
            </div>
            <Meter value={r.count} max={top} tone={muted ? 'slate' : tone} className="h-1.5" label={r.label} />
          </li>
        );
      })}
    </ul>
  );
}

function DistCard({ title, d }: { title: string; d: Dist }) {
  return (
    <SectionCard icon={Landmark} tone="indigo" title={title} description={`Latest accepted MIS value, verbatim · ${d.denominator.value} ${d.denominator.label} · ${d.dateBasis}`}>
      <Bars rows={d.buckets.map((b) => ({ key: b.value, label: b.value, count: b.count }))} max={d.denominator.value} tone="indigo" empty="No leads in this population." emptyIcon={Landmark} />
    </SectionCard>
  );
}

const FILTER_KEYS = ['from', 'to', 'managerId', 'telecallerId', 'advisorId', 'bankId', 'cardId', 'pincode', 'state', 'misRecency'] as const;
/** Query string of the dashboard filters present in `sp` (other params are ignored). */
export function opsQuery(sp: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sp[k]) qs.set(k, sp[k] as string);
  return qs.toString();
}

/** Dashboard filter form (GET to `basePath`); `hidden` carries extra params such as the selected period. */
export async function OpsFilters({ basePath, sp, hidden }: { basePath: string; sp: Record<string, string | undefined>; hidden?: Record<string, string> }) {
  const [users, banks] = await Promise.all([
    apiFetch<UserRow[]>('/users?pageSize=200').then((r) => r.data).catch(() => [] as UserRow[]),
    apiFetch<Bank[]>('/catalogue/banks').then((r) => r.data).catch(() => [] as Bank[]),
  ]);
  const telecallers = users.filter((u) => u.role === 'TELECALLER');
  const advisors = users.filter((u) => u.role === 'ADVISOR');
  const managers = users.filter((u) => u.role === 'MANAGER');
  const more = Boolean(sp.managerId || sp.pincode || sp.state || sp.misRecency);
  const moreCount = ['managerId', 'pincode', 'state', 'misRecency'].filter((k) => sp[k]).length;
  return (
    <form className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]" action={basePath}>
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <Field label="From" htmlFor="ops-from">
          <input id="ops-from" className={selectClass} type="date" name="from" defaultValue={sp.from ?? ''} />
        </Field>
        <Field label="To" htmlFor="ops-to">
          <input id="ops-to" className={selectClass} type="date" name="to" defaultValue={sp.to ?? ''} />
        </Field>
        <Field label="Telecaller" htmlFor="ops-telecaller">
          <select id="ops-telecaller" className={selectClass} name="telecallerId" defaultValue={sp.telecallerId ?? ''}>
            <option value="">All</option>
            {telecallers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Advisor" htmlFor="ops-advisor">
          <select id="ops-advisor" className={selectClass} name="advisorId" defaultValue={sp.advisorId ?? ''}>
            <option value="">All</option>
            {advisors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bank" htmlFor="ops-bank" className="col-span-2 sm:col-span-1">
          <select id="ops-bank" className={selectClass} name="bankId" defaultValue={sp.bankId ?? ''}>
            <option value="">All</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <Button type="submit" className="h-10">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="outline" className="h-10">
            <Link href={basePath}>Reset</Link>
          </Button>
        </div>
      </div>
      <details className="group mt-3 border-t border-slate-100 pt-3" open={more}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[12.5px] font-medium text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          More filters
          {moreCount ? <span className="rounded-full bg-teal-50 px-1.5 text-[10.5px] font-semibold text-teal-700 tabular-nums">{moreCount}</span> : null}
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3 grid grid-cols-2 items-end gap-3 lg:grid-cols-4">
          {managers.length ? (
            <Field label="Manager" htmlFor="ops-manager">
              <select id="ops-manager" className={selectClass} name="managerId" defaultValue={sp.managerId ?? ''}>
                <option value="">All</option>
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Pincode" htmlFor="ops-pincode">
            <input id="ops-pincode" className={selectClass} name="pincode" inputMode="numeric" maxLength={6} pattern="\d{6}" defaultValue={sp.pincode ?? ''} placeholder="6 digits" />
          </Field>
          <Field label="State" htmlFor="ops-state">
            <input id="ops-state" className={selectClass} name="state" defaultValue={sp.state ?? ''} placeholder="e.g. Rajasthan" />
          </Field>
          <Field label="MIS recency" htmlFor="ops-recency" className="col-span-2 sm:col-span-1">
            <select id="ops-recency" className={selectClass} name="misRecency" defaultValue={sp.misRecency ?? ''}>
              <option value="">Any</option>
              <option value="within7">Matched in last 7 days</option>
              <option value="within30">Matched in last 30 days</option>
              <option value="older30">Last match older than 30 days</option>
              <option value="never">Never matched</option>
            </select>
          </Field>
        </div>
      </details>
    </form>
  );
}

/** Calling and Advisor / bank / payout sections of the operations dashboard. */
export function OpsSections({ d }: { d: OpsDashboard }) {
  const c = d.calling;
  const a = d.advisors;
  const sum = (o: Record<string, Metric>) => Object.values(o).reduce((n, m) => n + m.value, 0);
  return (
    <>
      <section className="grid gap-4" aria-labelledby="calling-h">
        <SectionHeading id="calling-h" icon={PhoneCall} tone="sky" title="Calling operations" description="Records, provider-confirmed calls, callbacks and shares. Each figure shows its own source and date basis." />
        <TileGroup icon={Users} tone="violet" title="Customer records">
          <Tile label="Customer records uploaded" m={c.records.uploaded} tone="violet" />
          <Tile label="Assigned" m={c.records.assigned} tone="violet" />
          <Tile label="Active" m={c.records.active} tone="violet" />
          <Tile label="Hidden" m={c.records.hidden} tone="slate" />
        </TileGroup>
        <TileGroup icon={PhoneCall} tone="sky" title="Calls">
          <Tile label="Call attempts (provider-confirmed)" m={c.calls.attempts} tone="sky" />
          <Tile label="Failed before provider" m={c.calls.failedBeforeProvider} tone="rose" />
          <Tile label="Connected calls" m={c.calls.connected} tone="emerald" />
          <Tile label="Not answered" m={c.calls.notAnswered} tone="amber" />
          <Tile label="Failed (provider)" m={c.calls.failed} tone="rose" />
          <Tile label="Unique customers contacted" m={c.calls.uniqueCustomersContacted} tone="sky" />
          <Tile label="Recordings available" m={c.calls.recordingsAvailable} tone="sky" />
        </TileGroup>
        <TileGroup icon={CalendarClock} tone="amber" title="Callbacks & shares">
          <Tile label="Callbacks due (open)" m={c.callbacks.due} tone="amber" />
          <Tile label="Callbacks completed" m={c.callbacks.completed} tone="emerald" />
          <Tile label="Shares recorded" m={c.shares.total} tone="teal" />
          <Tile label="Shares delivered (status known)" m={c.shares.delivered} tone="teal" />
        </TileGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard icon={MessageSquareText} tone="sky" title="Customer-interest outcomes" description="Recorded by Telecallers · outcome recorded date. An outcome is not a bank application.">
            <Bars rows={Object.entries(c.outcomes).map(([k, v]) => ({ key: k, label: OUTCOME_LABEL[k] ?? k, count: v.value }))} max={sum(c.outcomes)} tone="sky" empty="No outcomes recorded." emptyIcon={MessageSquareText} />
          </SectionCard>
          <SectionCard icon={Share2} tone="teal" title="Shares by kind" description="Distinct recorded share actions · share recorded date.">
            <Bars rows={Object.entries(c.shares.byKind).map(([k, v]) => ({ key: k, label: SHARE_LABEL[k] ?? k, count: v.value }))} max={sum(c.shares.byKind)} tone="teal" empty="No shares recorded." emptyIcon={Share2} />
          </SectionCard>
        </div>
      </section>
      <section className="grid gap-4" aria-labelledby="adv-h">
        <SectionHeading id="adv-h" icon={Landmark} tone="indigo" title="Advisor leads & bank results" description="KBS leads and the latest accepted bank MIS values, shown exactly as the bank reported them." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Tile label="Leads created" m={a.leads.created} tone="violet" />
          <Tile label="Matched in bank MIS" m={a.leads.misMatched} tone="indigo" />
          <Tile label="Awaiting MIS" m={a.leads.awaitingMis} tone="slate" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <DistCard title="Current stage" d={a.stage} />
          <DistCard title="Final decision" d={a.decision} />
          <DistCard title="Card activation (distinct values)" d={a.activation} />
        </div>
        <SectionCard
          icon={MessageSquareWarning}
          tone="amber"
          title="Actionable bank reasons"
          description={`${a.bankReasons.leadsWithReason.value} of ${a.bankReasons.leadsWithReason.denominator?.value ?? 0} MIS-matched leads carry a bank remark or decline field (verbatim).`}
        >
          <Bars rows={a.bankReasons.top.map((r) => ({ key: r.value, label: r.value, count: r.count }))} tone="amber" empty="No bank reasons reported." emptyIcon={MessageSquareWarning} />
        </SectionCard>
        <TileGroup icon={Wallet} tone="teal" title="Payout card events">
          <Tile label="Eligible" m={a.payouts.eligible} money tone="teal" />
          <Tile label="Available to claim" m={a.payouts.available} money tone="teal" />
          <Tile label="Requested" m={a.payouts.requested} money tone="sky" />
          <Tile label="Approved, unpaid" m={a.payouts.approvedUnpaid} money tone="amber" />
          <Tile label="On hold" m={a.payouts.onHold} money tone="rose" />
          <Tile label="Paid (events)" m={a.payouts.paid} money tone="emerald" />
          <div className="col-span-2 flex min-w-0 flex-col rounded-xl border border-transparent bg-[linear-gradient(135deg,#0f766e_0%,#115e59_55%,#134e4a_100%)] p-4 text-white shadow-[0_12px_30px_-14px_rgb(15_118_110/70%)]">
            <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-teal-50">
              Confirmed transfers
              <BadgeIndianRupee className="size-4" aria-hidden="true" />
            </div>
            <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{formatInr(a.payouts.confirmedTransfersInr.amountInr ?? 0)}</div>
            <div className="min-h-3 flex-1" />
            <p className="border-t border-white/15 pt-2 text-[10.5px] leading-snug text-teal-50/90">Accounts payment · {a.payouts.confirmedTransfersInr.dateBasis}</p>
          </div>
        </TileGroup>
      </section>
    </>
  );
}

/**
 * F-702 (and F-703 executive) operations dashboard. Calls, shares, leads, bank values and payouts are separate
 * metrics, each labelled with its source and date basis; bank values are the latest accepted MIS, never live status.
 */
export async function OperationsDashboard({
  basePath,
  sp,
  title,
  endpoint,
}: {
  basePath: string;
  sp: Record<string, string | undefined>;
  title: string;
  endpoint: string;
}) {
  const d = (await apiFetch<OpsDashboard>(`${endpoint}?${opsQuery(sp)}`)).data;
  return (
    <div className="flex flex-col gap-3 overflow-y-auto lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">{title}</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <Badge variant="secondary">{d.scope}</Badge>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          {d.meta.from || d.meta.to ? `${d.meta.from ?? '…'} → ${d.meta.to ?? '…'}` : 'all time'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
          <Clock className="size-3.5" aria-hidden="true" />
          as of {formatDateTime(d.meta.asOf)}
        </span>
      </div>
      <OpsFilters basePath={basePath} sp={sp} />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="MIS freshness per bank">
        <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          <Database className="size-3.5" aria-hidden="true" />
          MIS freshness
        </span>
        {d.meta.misFreshness.map((f) => (
          <span key={f.bank.code} className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-white py-1 pr-2 pl-1 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
            <BankMark code={f.bank.code} size="sm" />
            <span className="truncate text-[12.5px] font-medium text-slate-800">{f.bank.displayName}</span>
            <Badge variant={f.lastAppliedAt ? 'info' : 'unknown'}>{f.lastAppliedAt ? `MIS applied ${formatDateTime(f.lastAppliedAt)}` : 'no MIS applied'}</Badge>
          </span>
        ))}
      </div>
      {d.alerts?.length ? (
        <Callout tone="warning" icon={TriangleAlert} title="Needs attention" role="alert">
          <ul className="mt-1 grid gap-1">
            {d.alerts.map((al) => (
              <li key={al.kind}>
                <Link href={al.href} className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline">
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                  {al.message}
                </Link>
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
      <OpsSections d={d} />
    </div>
  );
}
