import { formatDateTime, formatInr } from '@kbs/shared';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarRange,
  ChevronDown,
  CircleAlert,
  Clock3,
  CreditCard,
  Filter,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Phone,
  PhoneCall,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { OpsFilters, OpsSections, opsQuery, type OpsDashboard } from '@/components/operations-dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BankMark,
  Callout,
  EmptyState,
  IconTile,
  Meter,
  PageHeader,
  PillNav,
  SectionCard,
  StatCard,
  StatGrid,
  TONE,
  type Tone,
} from '@/components/ui/kit';
import {
  countSuccess,
  payoutSummarySchema,
  percentChange,
  PERIODS,
  resolvePeriod,
  type Range,
} from '@/lib/admin-overview';
import { ApiError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Business overview · KBS Solutions' };

type Tot = { count: number; amountInr: number };
interface MixRow {
  bank: { id: string; code: string; displayName: string };
  leads: number;
  misMatched: number;
  payoutEligible: Tot;
  payoutPaid: Tot;
}
interface Distribution {
  telecallers: { needsReassignment: boolean }[];
  unassigned: number | null;
}
type Advisors = OpsDashboard['advisors'];

const number = (value: number | null | undefined) =>
  value == null ? 'Unavailable' : value.toLocaleString('en-IN');
const total = (response: { meta: Record<string, unknown> } | null) =>
  typeof response?.meta.total === 'number' ? response.meta.total : null;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
const day = (d: string) =>
  new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
const rangeLabel = (r: Partial<Range>) =>
  r.from || r.to ? `${r.from ? day(r.from) : '…'} – ${r.to ? day(r.to) : 'today'}` : 'All time';

/** Business figures from one executive response (same cohort: leads created in the window). */
function figures(a: Advisors) {
  return {
    leads: a.leads.created.value,
    matched: a.leads.misMatched.value,
    approved: countSuccess('decision', a.decision.buckets),
    activated: countSuccess('activation', a.activation.buckets),
    earned: a.payouts.eligible.amountInr ?? 0,
    earnedEvents: a.payouts.eligible.value,
  };
}

/** Change vs the comparison window: arrow + % in text (never colour alone, REQ-20 §20.2). */
function Delta({
  current,
  previous,
  against,
  money,
  light,
}: {
  current: number;
  previous: number | null;
  against: string;
  money?: boolean;
  light?: boolean;
}) {
  if (previous == null) return null;
  const change = percentChange(current, previous) ?? (current ? null : 0);
  const text = change == null ? 'New' : change === 0 ? 'No change' : `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}%`;
  const tone = light
    ? 'bg-white/15 text-white'
    : change == null || change === 0
      ? 'bg-slate-100 text-slate-600'
      : change > 0
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-rose-50 text-rose-700';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', tone)}>{text}</span>
      <span>
        vs {money ? formatInr(previous) : previous.toLocaleString('en-IN')} · {against}
      </span>
    </span>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

/**
 * F-807 Business overview: the Admin home and the executive dashboard in one (REQ-16 §16.2). Business first —
 * period KPIs with change, the lead → bank funnel, bank performance and open queues; operational detail below.
 * Bank figures are the latest accepted MIS values as reported (INV-01..03); every figure names its source.
 */
export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const unavailable: string[] = [];
  async function load<T>(path: string, label: string) {
    try {
      return await apiFetch<T>(path);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirect('/login?next=%2Fadmin');
      unavailable.push(label);
      return null;
    }
  }
  const scoped = { ...sp, from: undefined, to: undefined };
  const q = opsQuery({ ...scoped, ...period.current });
  const [cur, prev, mix, ledger, approvals, approved, onboarding, distribution] = await Promise.all([
    load<OpsDashboard>(`/dashboards/admin/executive?${q}`, 'Business metrics'),
    period.previous
      ? load<OpsDashboard>(`/dashboards/admin/executive?${opsQuery({ ...scoped, ...period.previous })}`, 'Comparison period')
      : null,
    load<{ rows: MixRow[] }>(`/dashboards/admin/bank-card-mix?${q}`, 'Bank performance'),
    load<unknown[]>('/payouts/entitlements?pageSize=1', 'Payout ledger'),
    load<unknown[]>('/payouts/requests?awaitingMe=true&pageSize=1', 'Payout approvals'),
    load<unknown[]>('/payouts/requests?state=APPROVED&pageSize=1', 'Approved requests'),
    load<{ userId: string }[]>('/onboarding/review', 'Advisor reviews'),
    load<Distribution>('/calling/distribution', 'Calling operations'),
  ]);
  const d = cur?.data;
  const now = d ? figures(d.advisors) : null;
  const was = prev ? figures(prev.data.advisors) : null;
  const against = period.previous ? rangeLabel(period.previous) : '';
  const parsed = payoutSummarySchema.safeParse(ledger?.meta);
  const payouts = parsed.success ? parsed.data : null;
  if (ledger && !payouts) unavailable.push('Payout totals');

  // ── period chips keep every other filter; explicit dates are dropped so the chip wins ──
  const keep = opsQuery(scoped);
  const chipHref = (key: string) => `/admin?${keep ? `${keep}&` : ''}period=${key}`;
  const filterCount = ['managerId', 'telecallerId', 'advisorId', 'bankId', 'cardId', 'pincode', 'state', 'misRecency'].filter(
    (k) => sp[k],
  ).length;

  const funnel = now
    ? [
        { label: 'Leads created', value: now.leads, source: 'KBS leads', tone: 'violet' as Tone },
        { label: 'Matched in bank MIS', value: now.matched, source: 'Bank MIS', tone: 'indigo' as Tone },
        { label: 'Bank approved', value: now.approved, source: 'Bank MIS · decision', tone: 'teal' as Tone },
        { label: 'Card activated', value: now.activated, source: 'Bank MIS · activation', tone: 'emerald' as Tone },
      ]
    : [];

  const banks = [
    ...(mix?.data.rows ?? [])
      .reduce((map, r) => {
        const b = map.get(r.bank.id) ?? { bank: r.bank, leads: 0, matched: 0, eligible: 0, events: 0, paid: 0 };
        b.leads += r.leads;
        b.matched += r.misMatched;
        b.eligible += r.payoutEligible.amountInr;
        b.events += r.payoutEligible.count;
        b.paid += r.payoutPaid.amountInr;
        return map.set(r.bank.id, b);
      }, new Map<string, { bank: MixRow['bank']; leads: number; matched: number; eligible: number; events: number; paid: number }>())
      .values(),
  ].sort((a, b) => b.leads - a.leads || a.bank.displayName.localeCompare(b.bank.displayName));
  const freshness = new Map(d?.meta.misFreshness.map((f) => [f.bank.code, f.lastAppliedAt]) ?? []);

  const queues: { label: string; detail: string; count: number | null | undefined; href: string; icon: LucideIcon; tone: Tone }[] = [
    { label: 'Payout approvals', detail: 'Awaiting your decision', count: total(approvals), href: '/admin/payouts/requests?awaitingMe=true', icon: Wallet, tone: 'amber' },
    { label: 'Advisor reviews', detail: 'Onboarding awaiting review', count: onboarding?.data.length, href: '/admin/onboarding', icon: Users, tone: 'violet' },
    { label: 'Unassigned records', detail: 'Calling records needing allocation', count: distribution?.data.unassigned, href: '/admin/calling-list?status=UNASSIGNED#records', icon: Phone, tone: 'sky' },
    { label: 'Approved, awaiting payment', detail: 'Both approvals done · not yet paid', count: total(approved), href: '/admin/payouts/requests?state=APPROVED', icon: BadgeCheck, tone: 'teal' },
  ];
  const alerts = d?.alerts ?? [];
  const open = queues.filter((x) => x.count).length + alerts.length;

  const payoutRows = [
    { label: 'Available to claim', key: 'available', state: 'ELIGIBLE_AVAILABLE', tone: 'teal' },
    { label: 'Reserved in requests', key: 'reserved', state: 'RESERVED', tone: 'indigo' },
    { label: 'Paid card events', key: 'paid', state: 'PAID', tone: 'emerald' },
    { label: 'Pending hold', key: 'pendingHold', state: 'PENDING_HOLD', tone: 'amber' },
    { label: 'Under review', key: 'underReview', state: 'UNDER_REVIEW', tone: 'rose' },
  ] as const;
  const amounts = payouts?.amounts;
  const counts = payouts?.counts;
  const largestAmount = amounts ? Math.max(...payoutRows.map((r) => amounts[r.key])) : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={LayoutDashboard}
        eyebrow="Overview"
        title="Business overview"
        description="How the business is doing: leads, bank results and payouts for the selected period."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/leads">
                <ListChecks />
                Explore leads
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/mis">
                <ArrowDownToLine />
                Import bank MIS
              </Link>
            </Button>
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
              <CalendarRange className="size-3.5" />
              {rangeLabel(period.current)}
            </span>
            {period.previous ? <span>compared with {against}</span> : null}
            {d ? <Badge variant="secondary">{d.scope}</Badge> : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              as of {formatDateTime(d?.meta.asOf ?? new Date().toISOString())} · IST
            </span>
          </>
        }
      >
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <PillNav
            label="Period"
            items={PERIODS.map((p) => ({ href: chipHref(p.key), label: p.label }))}
            active={period.key === 'custom' ? '' : chipHref(period.key)}
            className="max-w-full min-w-0"
          />
          <details className="group/filters min-w-0 flex-1 basis-full [&[open]]:basis-full sm:basis-auto" open={period.key === 'custom' || filterCount > 0}>
            <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgb(15_23_42/4%)] hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <Filter className="size-3.5" aria-hidden="true" />
              Custom dates & filters
              {filterCount ? (
                <span className="rounded-full bg-teal-50 px-1.5 text-[10.5px] font-semibold text-teal-700 tabular-nums">{filterCount}</span>
              ) : null}
              <ChevronDown className="size-3.5 transition-transform group-open/filters:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-3">
              <OpsFilters basePath="/admin" sp={sp} />
            </div>
          </details>
        </div>
        {unavailable.length > 0 ? (
          <Callout tone="warning" icon={TriangleAlert} role="alert" title="Some data could not be loaded.">
            {unavailable.join(', ')}. Unavailable figures are not zero. Use the refresh button to retry.
          </Callout>
        ) : null}
        <StatGrid>
          <StatCard
            label="Leads created"
            value={number(now?.leads)}
            hint={now ? <Delta current={now.leads} previous={was?.leads ?? null} against={against} /> : undefined}
            source="KBS leads · created date"
            href="/admin/leads"
            icon={Users}
            tone="violet"
          />
          <StatCard
            label="Bank approved"
            value={number(now?.approved)}
            hint={
              now ? (
                <>
                  <span className="block">{pct(now.approved, now.leads) ?? 0}% of leads</span>
                  <Delta current={now.approved} previous={was?.approved ?? null} against={against} />
                </>
              ) : undefined
            }
            source="Bank MIS · final decision"
            href="/admin/leads"
            icon={ShieldCheck}
            tone="teal"
          />
          <StatCard
            label="Cards activated"
            value={number(now?.activated)}
            hint={
              now ? (
                <>
                  <span className="block">{pct(now.activated, now.leads) ?? 0}% of leads</span>
                  <Delta current={now.activated} previous={was?.activated ?? null} against={against} />
                </>
              ) : undefined
            }
            source="Bank MIS · activation"
            href="/admin/leads"
            icon={CreditCard}
            tone="emerald"
          />
          <StatCard
            label="Payout earned"
            value={now ? formatInr(now.earned) : 'Unavailable'}
            hint={
              now ? (
                <>
                  <span className="block">
                    {number(now.earnedEvents)} eligible card event{now.earnedEvents === 1 ? '' : 's'}
                  </span>
                  <Delta current={now.earned} previous={was?.earned ?? null} against={against} money light />
                </>
              ) : undefined
            }
            source="Payout ledger · eligible date"
            href="/admin/payouts/entitlements"
            icon={Wallet}
            emphasis
          />
        </StatGrid>
      </PageHeader>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          icon={Landmark}
          tone="indigo"
          title="Lead to card funnel"
          description="Leads created in the period and their latest bank MIS result, as reported. A match is not an approval."
          bodyClassName="grid gap-5"
        >
          {funnel.length ? (
            <ol className="grid gap-3.5">
              {funnel.map((step, i) => {
                const ofPrev = i ? pct(step.value, funnel[i - 1].value) : null;
                return (
                  <li key={step.label} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-medium text-slate-800">
                        {step.label}
                        <span className="ml-2 text-[11px] font-normal text-slate-400">{step.source}</span>
                      </span>
                      <span className="flex items-baseline gap-2 tabular-nums">
                        {ofPrev != null ? <span className="text-[11px] text-slate-500">{ofPrev}% of previous</span> : null}
                        <span className="text-base font-semibold text-slate-900">{number(step.value)}</span>
                      </span>
                    </div>
                    <Meter value={step.value} max={Math.max(1, funnel[0].value)} tone={step.tone} className="h-2.5" label={step.label} />
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState icon={Landmark} title="Funnel unavailable" description="Business metrics could not be loaded. Refresh to retry." />
          )}
          {d ? (
            <div className="grid gap-2 border-t border-slate-100 pt-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <PhoneCall className="size-3.5" aria-hidden="true" />
                Calling activity · same period
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ['Call attempts', d.calling.calls.attempts.value],
                    ['Connected', d.calling.calls.connected.value],
                    ['Customers contacted', d.calling.calls.uniqueCustomersContacted.value],
                    ['Shares recorded', d.calling.shares.total.value],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                    <p className="text-lg font-semibold tabular-nums">{number(value)}</p>
                    <p className="text-[11px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10.5px] text-slate-400">
                Telecaller calls are a separate population from Advisor leads; they are not a funnel step.
              </p>
            </div>
          ) : null}
        </SectionCard>

        <section
          aria-labelledby="attention-title"
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <IconTile icon={CircleAlert} tone={open ? 'amber' : 'emerald'} size="sm" />
              <div>
                <h2 id="attention-title" className="text-[15px] leading-6 font-semibold tracking-tight text-slate-900">
                  Needs your attention
                </h2>
                <p className="text-[12.5px] text-slate-500">Open work queues and system alerts</p>
              </div>
            </div>
            <Badge variant={open ? 'warning' : 'success'}>{open ? `${open} open` : 'All clear'}</Badge>
          </div>
          <ul className="divide-y divide-slate-100">
            {queues.map(({ label, detail, count, href, icon, tone }) => (
              <li key={label}>
                <Link
                  href={href}
                  prefetch={false}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700"
                >
                  <IconTile icon={icon} tone={count ? tone : 'slate'} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    <span className="text-[11px] text-slate-500">{detail}</span>
                  </span>
                  <span className={cn('text-lg font-semibold tabular-nums', count ? TONE[tone].text : 'text-slate-400')}>
                    {number(count)}
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-slate-400 group-hover:text-teal-700" />
                </Link>
              </li>
            ))}
            {alerts.map((al) => (
              <li key={al.kind}>
                <Link
                  href={al.href}
                  prefetch={false}
                  className="group flex items-center gap-3 bg-amber-50/50 px-5 py-3 text-[13px] text-amber-950 hover:bg-amber-50"
                >
                  <TriangleAlert className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{al.message}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-amber-700" />
                </Link>
              </li>
            ))}
          </ul>
          {distribution?.data.telecallers.some((t) => t.needsReassignment) ? (
            <Callout tone="warning" icon={TriangleAlert} className="m-4">
              Some telecallers hold records that need reassignment. Review allocation.
            </Callout>
          ) : null}
        </section>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          icon={Landmark}
          tone="indigo"
          title="Bank performance"
          description="Leads created in the period, bank by bank, with MIS coverage and payout events for those leads."
          actions={<SectionLink href={`/admin/dashboards/bank-card-mix${q ? `?${q}` : ''}`}>Bank / card mix</SectionLink>}
        >
          {banks.length ? (
            <ul className="divide-y divide-slate-100">
              {banks.map((b) => {
                const applied = freshness.get(b.bank.code);
                return (
                  <li key={b.bank.id} className="grid items-center gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="flex min-w-0 items-center gap-3">
                      <BankMark code={b.bank.code} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/leads?bankId=${b.bank.id}`} className="text-sm font-semibold text-slate-900 hover:text-teal-700">
                          {b.bank.displayName}
                        </Link>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Meter value={b.matched} max={Math.max(1, b.leads)} tone="indigo" className="h-1.5 max-w-32" label={`${b.bank.displayName} MIS matched`} />
                          <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">{pct(b.matched, b.leads) ?? 0}% matched</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {applied ? `Last MIS applied ${formatDateTime(applied)}` : 'No MIS applied yet'}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm sm:text-right">
                      <span className="font-semibold tabular-nums">{number(b.leads)}</span>
                      <span className="ml-1 text-[11px] text-slate-500 sm:ml-0 sm:block">lead{b.leads === 1 ? '' : 's'}</span>
                    </div>
                    <div className="text-sm sm:min-w-36 sm:text-right">
                      <span className="font-semibold tabular-nums">{formatInr(b.eligible)}</span>
                      <span className="block text-[11px] text-slate-500 tabular-nums">
                        {b.events} event{b.events === 1 ? '' : 's'} · {formatInr(b.paid)} paid
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Landmark}
              title={mix ? 'No leads in this period' : 'Bank performance unavailable'}
              description={mix ? 'Pick a longer period to see bank results.' : 'Refresh to retry.'}
            />
          )}
        </SectionCard>

        <SectionCard
          icon={Wallet}
          tone="teal"
          title="Payout position"
          description="Current ledger balances (all time). Approval is not payment."
          actions={<SectionLink href="/admin/payouts/entitlements">Open ledger</SectionLink>}
          bodyClassName="grid gap-4"
        >
          <div className="divide-y divide-slate-100">
            {payoutRows.map(({ label, key, state, tone }) => (
              <Link key={key} href={`/admin/payouts/entitlements?state=${state}`} className="group grid gap-2 py-3 first:pt-0">
                <span className="flex items-center gap-2.5">
                  <span className={`size-2 shrink-0 rounded-full ${TONE[tone].bar}`} />
                  <span className="flex-1 text-sm text-slate-800 group-hover:text-teal-700">
                    {label}
                    <span className="ml-2 text-[11px] text-slate-500">
                      {number(counts?.[key])} {counts?.[key] === 1 ? 'event' : 'events'}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{amounts ? formatInr(amounts[key]) : 'Unavailable'}</span>
                </span>
                {amounts?.[key] ? (
                  <Meter value={amounts[key]} max={largestAmount} tone={tone} className="ml-4.5 h-1 w-auto" label={label} />
                ) : null}
              </Link>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Positions overlap with eligible events; they are not extra balances to add together.
          </p>
          <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-500">
            Source: KBS payout ledger ·{' '}
            {ledger?.meta.asOf ? formatDateTime(String(ledger.meta.asOf)) : 'Snapshot time unavailable'}
          </div>
        </SectionCard>
      </div>

      {d ? (
        <details className="group grid gap-6 rounded-2xl border border-slate-200/80 bg-white/60 p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-[15px] font-semibold text-slate-900">Operational detail</span>
              <span className="text-[12.5px] text-slate-500">
                Calling records, calls, callbacks, shares, bank value breakdowns and payout events — each with its source and date basis.
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-6 grid gap-6">
            <OpsSections d={d} />
          </div>
        </details>
      ) : null}

      <footer className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
        <span className="inline-flex max-w-3xl items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Bank figures reflect the latest accepted MIS for leads created in the period — not live bank status. Recent
          leads may still be in process; blank values mean “Not reported”.
        </span>
      </footer>
    </div>
  );
}
