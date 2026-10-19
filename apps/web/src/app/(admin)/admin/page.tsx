import { type AdminTodayResponse, type AdminTrendResponse, type CallingRecordsSummary, formatInr, type LeadStatusRow } from '@kbs/shared';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FilePlus2,
  ListChecks,
  PhoneCall,
  Search,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DeltaBadge, MiniBars, StackedBars } from '@/components/ui/charts';
import { Callout, MiniStat, RailCard, SectionCard, selectClass } from '@/components/ui/kit';
import { istNow, PERIODS, resolvePeriod } from '@/lib/admin-overview';
import { ApiError, apiFetch, getSession } from '@/lib/api';
import { cn } from '@/lib/utils';

import { RecentLeadsTable } from './recent-leads-table';

export const metadata = { title: 'Business overview · KBS Solutions' };

interface Metric {
  value: number;
  amountInr?: number;
}
interface Home {
  range: { from: string | null; to: string | null };
  people: Record<'TELECALLER' | 'MANAGER' | 'ADVISOR' | 'ACCOUNTS', { total: number; active: number }>;
  cumulative: {
    mis: { total: number; approved: number; declined: number; inProcess: number; cardsActive: number; cardsInactive: number; activationBlank: number };
    payouts: { eligible: { amountInr: number }; paid: { amountInr: number } };
  };
  business: {
    leads: { created: Metric; misMatched: Metric; awaitingMis: Metric };
    approved: number;
    activated: number;
    declined: number;
    inProcess: number;
    payouts: { eligible: Metric; paid: Metric };
  };
  calling: {
    calls: { attempts: Metric; failedBeforeProvider: Metric; connected: Metric; notAnswered: Metric; failed: Metric; uniqueCustomersContacted: Metric };
    callbacks: { due: Metric; completed: Metric };
    outcomes: Record<string, Metric | undefined>;
    shares: { total: Metric; delivered: Metric };
    pipeline: CallingRecordsSummary;
  };
  /** F-814: the equal-length period before [from, to] */
  previous: { leads: number; approved: number; activated: number; payoutEarnedInr: number; calls: number; connected: number } | null;
  recentLeads: LeadStatusRow[];
  asOf: string;
  note: string;
}

/** Outcomes that mean the customer showed interest (CallOutcome enum). */
const INTERESTED_OUTCOMES = ['CONNECTED_INTERESTED', 'CONNECTED_LINK_OR_PDF_SHARED'] as const;
const interested = (outcomes: Record<string, Metric | undefined>) => INTERESTED_OUTCOMES.reduce((n, k) => n + (outcomes[k]?.value ?? 0), 0);

const DAY = 86_400_000;
const IST = 5.5 * 3_600_000;
const day = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const pct = (v: number, of: number) => (of ? `${Math.round((v / of) * 100)}%` : undefined);
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/**
 * F-811 → F-814 Business overview (Admin home): greeting, period KPIs with change vs the previous period, trend,
 * calling funnel, all-time context, newest leads, and a Today rail of what waits on the Admin. Bank figures are
 * the bank status as the bank reported it (INV-01..03).
 */
export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const qs = new URLSearchParams();
  if (period.current.from) qs.set('from', period.current.from);
  if (period.current.to) qs.set('to', period.current.to);
  const qsStr = qs.toString();
  // the chart needs a window: the period itself when it spans a week or more, otherwise the 14 days ending with it
  const clock = istNow();
  const todayIst = clock.today;
  const to = period.current.to ?? todayIst;
  const from = period.current.from && Date.parse(to) - Date.parse(period.current.from) >= 6 * DAY ? period.current.from : shift(to, -13);
  const trendIsPeriod = from === period.current.from;

  let home: Home;
  const [homeRes, trendRes, todayRes, session] = await Promise.allSettled([
    apiFetch<Home>(`/dashboards/admin/home${qsStr ? `?${qsStr}` : ''}`),
    apiFetch<AdminTrendResponse>(`/dashboards/admin/trend?from=${from}&to=${to}`),
    apiFetch<AdminTodayResponse>('/dashboards/admin/today'),
    getSession(),
  ]);
  if (homeRes.status === 'fulfilled') home = homeRes.value.data;
  else {
    if (homeRes.reason instanceof ApiError && homeRes.reason.status === 401) redirect('/login?next=%2Fadmin');
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Business overview</h1>
        <Callout tone="warning" icon={TriangleAlert} role="alert" title="Dashboard data could not be loaded.">
          Refresh to retry. Unavailable figures are not zero.
        </Callout>
      </div>
    );
  }
  const trend = trendRes.status === 'fulfilled' ? trendRes.value.data : null;
  const today = todayRes.status === 'fulfilled' ? todayRes.value.data : null;
  const name = session.status === 'fulfilled' ? session.value?.user.fullName : null;

  const { people, cumulative, business, calling, recentLeads, previous: prev } = home;
  const pipeline = calling.pipeline;
  const rangeLabel = home.range.from || home.range.to ? `${home.range.from ? day(home.range.from) : '…'} – ${home.range.to ? day(home.range.to) : 'today'}` : 'All time';
  const calls = calling.calls;
  const team = [
    { n: people.TELECALLER.total, label: people.TELECALLER.total === 1 ? 'telecaller' : 'telecallers', role: 'TELECALLER' },
    { n: people.MANAGER.total, label: people.MANAGER.total === 1 ? 'manager' : 'managers', role: 'MANAGER' },
    { n: people.ADVISOR.total, label: people.ADVISOR.total === 1 ? 'advisor' : 'advisors', role: 'ADVISOR' },
    { n: people.ACCOUNTS.total, label: people.ACCOUNTS.total === 1 ? 'accounts user' : 'accounts users', role: 'ACCOUNTS' },
  ];

  const worked = Math.max(0, pipeline.total - (pipeline.byStatus.UNTOUCHED ?? 0) - (pipeline.byStatus.UNASSIGNED ?? 0));
  const earned = business.payouts.eligible.amountInr ?? 0;
  const prevLabel = prev ? 'vs the period before' : rangeLabel;
  const kpis = [
    { label: 'Leads created', value: business.leads.created.value, prev: prev?.leads, hint: `${business.leads.misMatched.value} with a bank status · ${business.leads.awaitingMis.value} awaiting`, icon: FilePlus2, href: '/admin/leads', hero: true },
    { label: 'Bank approved', value: business.approved, prev: prev?.approved, hint: `${business.declined} declined · ${business.inProcess} in process`, icon: BadgeCheck },
    { label: 'Cards activated', value: business.activated, prev: prev?.activated, hint: 'Reported active by the bank', icon: CreditCard },
    { label: 'Calls connected', value: calls.connected.value, prev: prev?.connected, hint: `${calls.attempts.value} attempts`, icon: PhoneCall, href: '/admin/calling-list/performance' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="relative z-20 flex flex-wrap items-end gap-x-4 gap-y-3 pt-1">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-9 font-medium tracking-tight text-balance text-foreground sm:text-[36px] sm:leading-[44px]">
            {clock.greeting}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {clock.dateLabel} · leads, bank results, calling and payouts at a glance.
          </p>
        </div>
        <details className="group/period relative ml-auto">
          <summary
            aria-label="Period"
            className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full bg-card px-4 text-ui font-medium text-foreground shadow-card hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
          >
            <CalendarRange className="size-4 text-fg-3" aria-hidden="true" />
            {period.label} <span className="text-xs text-muted-foreground">{rangeLabel}</span>
            <ChevronDown className="size-3.5 transition-transform group-open/period:rotate-180" aria-hidden="true" />
          </summary>
          <div role="menu" className="absolute right-0 z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-card p-2 shadow-pop">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                role="menuitem"
                href={`/admin?period=${p.key}`}
                prefetch={false}
                aria-current={period.key === p.key ? 'page' : undefined}
                className="block rounded-xl px-3 py-2 text-sm text-fg-2 hover:bg-surface-muted aria-[current=page]:bg-surface-muted aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
              >
                {p.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-border-subtle pt-2">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Custom range</p>
              <Form action="/admin" className="grid gap-2 px-3 pb-1">
                <input type="date" name="from" aria-label="From" defaultValue={sp.from ?? period.current.from ?? ''} className={cn(selectClass, 'h-9 px-3 text-xs')} />
                <input type="date" name="to" aria-label="To" defaultValue={sp.to ?? period.current.to ?? ''} className={cn(selectClass, 'h-9 px-3 text-xs')} />
                <Button type="submit" size="sm">
                  Apply
                </Button>
              </Form>
            </div>
          </div>
        </details>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,1.15fr)]">
        {/* the reference "Total balance" card: the payout earned in the period, its change, two actions, the team as "wallets" */}
        <section aria-label="Payout earned" className="flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-ui font-medium text-fg-2">Payout earned</h2>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-2xs font-medium text-fg-2">{rangeLabel}</span>
          </div>
          <div>
            <p className="truncate text-[34px] leading-10 font-semibold tracking-tight text-foreground tabular-nums">{formatInr(earned)}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {prev ? <DeltaBadge current={earned} previous={prev.payoutEarnedInr} suffix="" /> : null}
              <span>
                {business.payouts.eligible.value} card events · {formatInr(business.payouts.paid.amountInr ?? 0)} paid {prev ? `· ${prevLabel}` : ''}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild>
              <Link href="/admin/payouts/requests" prefetch={false}>
                <Wallet />
                Payout requests
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/payouts/entitlements" prefetch={false}>
                <ListChecks />
                Entitlements
              </Link>
            </Button>
          </div>
          <div className="mt-auto rounded-2xl bg-surface-muted p-3">
            <p className="px-1 pb-2.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Team</span> · {team.reduce((n, t) => n + t.n, 0)} people
            </p>
            <div className="grid grid-cols-3 gap-2">
              {team.slice(0, 3).map((t) => {
                const active = people[t.role as keyof typeof people].active;
                return (
                  <Link key={t.role} href={`/admin/users?role=${t.role}`} prefetch={false} className="min-w-0 rounded-xl bg-card p-2.5 transition-colors hover:bg-card/70 focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="block truncate text-2xs font-medium text-fg-2 capitalize">{t.label}</span>
                    <span className="mt-1 block text-lg leading-6 font-semibold text-foreground tabular-nums">{t.n}</span>
                    <span className={cn('mt-1 block truncate text-2xs font-medium', active ? 'text-emerald-700' : 'text-muted-foreground')}>{active ? `${active} active` : 'None active'}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-label="Business" className="grid min-w-0 grid-cols-2 gap-2.5 rounded-2xl bg-card p-2.5 shadow-card">
          {kpis.map((k) => {
            const body = (
              <>
                <span className="flex items-start justify-between gap-2">
                  <span className={cn('text-ui font-medium', k.hero ? 'text-white/90' : 'text-fg-2')}>{k.label}</span>
                  <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-full', k.hero ? 'bg-white/20 text-white' : 'bg-card text-fg-2')}>
                    <k.icon className="size-3.5" aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-3 block truncate text-[30px] leading-9 font-semibold tracking-tight tabular-nums">{k.value.toLocaleString('en-IN')}</span>
                <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-2xs">
                  {k.prev != null ? <DeltaBadge current={k.value} previous={k.prev} suffix="" className={k.hero ? 'bg-white/20 text-white' : undefined} /> : null}
                  <span className={cn('truncate', k.hero ? 'text-white/85' : 'text-muted-foreground')} title={k.hint}>
                    {k.hint}
                  </span>
                </span>
              </>
            );
            const cls = cn('min-w-0 rounded-2xl p-4', k.hero ? 'brand-gradient text-white shadow-pop' : 'bg-surface-muted text-foreground', k.href && 'lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring');
            return k.href ? (
              <Link key={k.label} href={k.href} prefetch={false} className={cls}>
                {body}
              </Link>
            ) : (
              <div key={k.label} className={cls}>
                {body}
              </div>
            );
          })}
        </section>

        <section aria-label="Trend" className="min-w-0 rounded-2xl bg-card p-5 shadow-card lg:col-span-2 xl:col-span-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Leads & approvals</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{trendIsPeriod ? rangeLabel : `Last 14 days (${day(from)} – ${day(to)})`} · by lead created date</p>
          <div className="mt-4 rounded-2xl bg-surface-muted p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Leads by bank result</p>
              <p className="flex items-center gap-3 text-2xs text-fg-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
                  Other leads
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-foreground" aria-hidden="true" />
                  Bank approved
                </span>
              </p>
            </div>
            {trend ? (
              <StackedBars
                title="Leads created per period, split into bank approved and other leads"
                labels={trend.points.map((p) => (trend.bucket === 'week' ? `w/c ${day(p.start)}` : day(p.start)))}
                base={trend.points.map((p) => p.approved)}
                rest={trend.points.map((p) => Math.max(0, p.leads - p.approved))}
                baseLabel="Bank approved"
                restLabel="Other leads"
              />
            ) : (
              <Callout tone="warning" icon={TriangleAlert} title="Trend could not be loaded.">
                Refresh to retry. The figures beside it are unaffected.
              </Callout>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        <aside aria-label="Today" className="flex min-w-0 flex-col gap-4">
          <section aria-label="Calling progress" className="rounded-2xl bg-card p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Calling progress</h2>
              <Link href="/admin/calling-list" prefetch={false} className="text-xs font-semibold text-foreground hover:underline">
                Records
              </Link>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-muted" role="meter" aria-label="Calling records worked" aria-valuemin={0} aria-valuemax={pipeline.total} aria-valuenow={worked}>
              <div className="brand-hatch h-full rounded-full" style={{ width: `${pipeline.total ? Math.round((worked / pipeline.total) * 100) : 0}%` }} />
            </div>
            <p className="mt-2.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>
                <b className="font-semibold text-foreground tabular-nums">{worked}</b> worked of {pipeline.total}
              </span>
              <span>
                {pipeline.byStatus.UNTOUCHED ?? 0} not called · {pipeline.followUpsDue} follow-ups due
              </span>
            </p>
          </section>
          <h2 className="sr-only">Today</h2>
          {today ? (
            <>
              <RailCard
                title="Follow-ups due"
                icon={CalendarClock}
                count={today.followUps.count}
                empty="Nothing due today."
                items={today.followUps.items.map((t) => ({
                  key: t.id,
                  href: t.leadId ? `/admin/leads/${t.leadId}` : '/admin/calling-list',
                  title: t.text,
                  meta: `${t.kind === 'LEAD' ? 'Lead follow-up' : 'Callback'}${t.ownerName ? ` · ${t.ownerName}` : ''}`,
                  aside: Date.parse(t.dueAt) < Date.parse(`${todayIst}T00:00:00+05:30`) ? 'Overdue' : time(t.dueAt),
                }))}
              />
              <RailCard
                title="Payouts awaiting you"
                icon={Wallet}
                count={today.payoutApprovals.count}
                empty="No payout request is waiting for the Admin."
                items={today.payoutApprovals.items.map((r) => ({ key: r.id, href: `/admin/payouts/requests/${r.id}`, title: r.advisorName ?? r.publicRef, meta: r.publicRef, aside: formatInr(r.amountInr) }))}
                footer={today.payoutApprovals.count ? { href: '/admin/payouts/requests?awaitingMe=true', label: 'All awaiting my approval' } : undefined}
              />
              <RailCard
                title="Advisors awaiting review"
                icon={ClipboardCheck}
                count={today.onboarding.count}
                empty="No onboarding is waiting for review."
                items={today.onboarding.items.map((a) => ({ key: a.userId, href: `/admin/onboarding/${a.userId}`, title: a.fullName ?? a.publicRef, meta: a.publicRef, aside: a.submittedAt ? day(new Date(Date.parse(a.submittedAt) + IST).toISOString().slice(0, 10)) : undefined }))}
                footer={today.onboarding.count ? { href: '/admin/onboarding', label: 'Advisor approvals' } : undefined}
              />
            </>
          ) : (
            <Callout tone="warning" icon={TriangleAlert} title="Today's queues could not be loaded.">
              Refresh to retry.
            </Callout>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard
            title="Recent leads"
            description="Newest in the period · bank values as the bank reported them"
            flush
            actions={
              <>
                <Form action="/admin/leads" className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                  <input name="q" aria-label="Search leads" placeholder="Search leads" className={cn(selectClass, 'h-9 w-44 pl-9 sm:w-56')} />
                </Form>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/leads" prefetch={false}>
                    All leads <ArrowRight />
                  </Link>
                </Button>
              </>
            }
          >
            <RecentLeadsTable rows={recentLeads} />
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SectionCard
              title="Calling performance"
              description={`${pipeline.total} records · ${pipeline.byStatus.UNTOUCHED} not yet called · ${pipeline.byStatus.UNASSIGNED} waiting for a caller · ${pipeline.followUpsDue} follow-ups due now`}
              actions={
                <Link href="/admin/calling-list/performance" className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline">
                  Caller performance <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              }
            >
              <MiniBars
                items={[
                  { label: 'Call attempts', value: calls.attempts.value, tone: 'indigo', hint: prev ? <DeltaBadge current={calls.attempts.value} previous={prev.calls} suffix="" /> : `${calls.failedBeforeProvider.value} failed before dialling` },
                  { label: 'Connected', value: calls.connected.value, tone: 'emerald', hint: pct(calls.connected.value, calls.attempts.value) },
                  { label: 'Not answered', value: calls.notAnswered.value, tone: 'amber', hint: pct(calls.notAnswered.value, calls.attempts.value) },
                  { label: 'Failed', value: calls.failed.value, tone: 'rose', hint: pct(calls.failed.value, calls.attempts.value) },
                  { label: 'Customers contacted', value: calls.uniqueCustomersContacted.value, tone: 'sky' },
                  { label: 'Interested', value: interested(calling.outcomes), tone: 'teal', hint: 'furthest KBS-known step' },
                  { label: 'Links / PDFs shared', value: calling.shares.total.value, tone: 'violet', hint: `${calling.shares.delivered.value} delivered` },
                  { label: 'Callbacks done', value: calling.callbacks.completed.value, tone: 'slate', hint: `${calling.callbacks.due.value} due` },
                ]}
              />
              {prev ? <p className="mt-3 text-xs text-muted-foreground">{calls.failedBeforeProvider.value} attempts failed before dialling.</p> : null}
            </SectionCard>

            <SectionCard title="All time" description="Latest bank-reported state per application">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Applications reported" value={cumulative.mis.total} hint="Latest bank-reported state per application" href="/admin/mis" tone="sky" />
                <MiniStat label="Approved" value={cumulative.mis.approved} hint={`${cumulative.mis.declined} declined · ${cumulative.mis.inProcess} in process`} tone="emerald" />
                <MiniStat label="Cards active" value={cumulative.mis.cardsActive} hint={`${cumulative.mis.cardsInactive} inactive · ${cumulative.mis.activationBlank} not reported`} tone="teal" />
                <MiniStat label="Payout earned" value={formatInr(cumulative.payouts.eligible.amountInr)} hint={`${formatInr(cumulative.payouts.paid.amountInr)} paid`} href="/admin/payouts/entitlements" tone="amber" />
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
