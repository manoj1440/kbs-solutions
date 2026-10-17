import { type AdminTodayResponse, type AdminTrendResponse, type CallingRecordsSummary, formatDateTime, formatInr, type LeadStatusRow } from '@kbs/shared';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FilePlus2,
  FileWarning,
  ListChecks,
  PhoneCall,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DeltaBadge, MiniBars } from '@/components/ui/charts';
import { Callout, MiniStat, RailCard, SectionCard, selectClass, StatCard, StatGrid } from '@/components/ui/kit';
import { TrendChart } from '@/components/ui/trend-chart';
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
 * the latest accepted MIS values as reported (INV-01..03); every section names its source.
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
  const misToResolve = today ? today.misExceptions.unmatched + today.misExceptions.conflicts : 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="relative z-20 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-[28px] sm:leading-9">
            {clock.greeting}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{clock.dateLabel}</span>
            <span aria-hidden="true">·</span>
            {team.map((t, i) => (
              <span key={t.role} className="inline-flex items-center gap-2">
                <Link href={`/admin/users?role=${t.role}`} prefetch={false} className="hover:text-foreground">
                  <b className="font-semibold text-fg-2 tabular-nums">{t.n}</b> {t.label}
                </Link>
                {i < team.length - 1 ? <span aria-hidden="true">·</span> : null}
              </span>
            ))}
          </p>
        </div>
        <details className="group/period relative ml-auto">
          <summary
            aria-label="Period"
            className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] font-medium text-fg-2 shadow-card hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
          >
            <CalendarRange className="size-3.5" aria-hidden="true" />
            {period.label} <span className="text-xs text-muted-foreground">{rangeLabel}</span>
            <ChevronDown className="size-3.5 transition-transform group-open/period:rotate-180" aria-hidden="true" />
          </summary>
          <div role="menu" className="absolute right-0 z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-2 shadow-pop">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                role="menuitem"
                href={`/admin?period=${p.key}`}
                prefetch={false}
                aria-current={period.key === p.key ? 'page' : undefined}
                className="block rounded-lg px-3 py-2 text-sm text-fg-2 hover:bg-surface-muted aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-primary"
              >
                {p.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-border-subtle pt-2">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Custom range</p>
              <Form action="/admin" className="grid gap-2 px-3 pb-1">
                <input type="date" name="from" aria-label="From" defaultValue={sp.from ?? period.current.from ?? ''} className={cn(selectClass, 'h-8 px-2 text-xs')} />
                <input type="date" name="to" aria-label="To" defaultValue={sp.to ?? period.current.to ?? ''} className={cn(selectClass, 'h-8 px-2 text-xs')} />
                <Button type="submit" size="sm" className="h-8">
                  Apply
                </Button>
              </Form>
            </div>
          </div>
        </details>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Business">
            <StatGrid>
              <StatCard
                emphasis
                label="Leads created"
                value={business.leads.created.value}
                delta={prev ? <DeltaBadge current={business.leads.created.value} previous={prev.leads} className="bg-white/15 text-white" /> : null}
                hint={`${business.leads.misMatched.value} matched in bank MIS · ${business.leads.awaitingMis.value} awaiting`}
                icon={FilePlus2}
                href="/admin/leads"
              />
              <StatCard
                label="Bank approved"
                value={business.approved}
                delta={prev ? <DeltaBadge current={business.approved} previous={prev.approved} /> : null}
                hint={`${business.declined} declined · ${business.inProcess} in process`}
                icon={BadgeCheck}
                tone="emerald"
              />
              <StatCard
                label="Cards activated"
                value={business.activated}
                delta={prev ? <DeltaBadge current={business.activated} previous={prev.activated} /> : null}
                hint="Bank MIS · activation"
                icon={CreditCard}
                tone="teal"
              />
              <StatCard
                label="Payout earned"
                value={formatInr(business.payouts.eligible.amountInr ?? 0)}
                delta={prev ? <DeltaBadge current={business.payouts.eligible.amountInr ?? 0} previous={prev.payoutEarnedInr} /> : null}
                hint={`${business.payouts.eligible.value} card events · ${formatInr(business.payouts.paid.amountInr ?? 0)} paid`}
                icon={Wallet}
                tone="amber"
                href="/admin/payouts/entitlements"
              />
            </StatGrid>
            <p className="mt-2 text-xs text-muted-foreground">
              Leads created {rangeLabel} → their latest bank MIS result · payout by eligible date{prev ? ' · change vs the same length of time before' : ''}.
            </p>
          </section>

          <SectionCard
            title="Trend"
            icon={TrendingUp}
            tone="teal"
            description={`${trendIsPeriod ? rangeLabel : `Last 14 days (${day(from)} – ${day(to)})`} · leads by created date, bank results from the latest MIS`}
          >
            {trend ? (
              <TrendChart
                title="Leads, bank approvals and card activations over time"
                labels={trend.points.map((p) => (trend.bucket === 'week' ? `w/c ${day(p.start)}` : day(p.start)))}
                series={[
                  { key: 'leads', label: 'Leads created', tone: 'teal', values: trend.points.map((p) => p.leads) },
                  { key: 'approved', label: 'Bank approved', tone: 'indigo', values: trend.points.map((p) => p.approved) },
                  { key: 'activated', label: 'Cards activated', tone: 'amber', values: trend.points.map((p) => p.activated) },
                ]}
              />
            ) : (
              <Callout tone="warning" icon={TriangleAlert} title="Trend could not be loaded.">
                Refresh to retry. The figures above are unaffected.
              </Callout>
            )}
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SectionCard
              title="Calling performance"
              icon={PhoneCall}
              tone="sky"
              description={`${pipeline.total} records · ${pipeline.byStatus.UNTOUCHED} not yet called · ${pipeline.byStatus.UNASSIGNED} waiting for a caller · ${pipeline.followUpsDue} follow-ups due now`}
              actions={
                <Link href="/admin/calling-list/performance" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
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

            <SectionCard title="All time" icon={ListChecks} tone="slate" description="Latest bank-reported state per application">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Applications reported" value={cumulative.mis.total} hint="Latest bank-reported state per application" href="/admin/mis" tone="sky" />
                <MiniStat label="Approved" value={cumulative.mis.approved} hint={`${cumulative.mis.declined} declined · ${cumulative.mis.inProcess} in process`} tone="emerald" />
                <MiniStat label="Cards active" value={cumulative.mis.cardsActive} hint={`${cumulative.mis.cardsInactive} inactive · ${cumulative.mis.activationBlank} not reported`} tone="teal" />
                <MiniStat label="Payout earned" value={formatInr(cumulative.payouts.eligible.amountInr)} hint={`${formatInr(cumulative.payouts.paid.amountInr)} paid`} href="/admin/payouts/entitlements" tone="amber" />
              </div>
            </SectionCard>
          </div>


        </div>

        <aside aria-label="Today" className="flex min-w-0 flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Today</h2>
          {today ? (
            <>
              {misToResolve ? (
                <Callout tone="danger" icon={FileWarning} title={`${misToResolve} bank MIS row${misToResolve === 1 ? '' : 's'} to resolve`}>
                  {today.misExceptions.unmatched} unmatched · {today.misExceptions.conflicts} in conflict.{' '}
                  <Link href="/admin/mis/integrity" className="font-semibold underline underline-offset-2">
                    Resolve
                  </Link>
                </Callout>
              ) : null}
              <RailCard
                title="Follow-ups due"
                icon={CalendarClock}
                tone={today.followUps.overdue ? 'rose' : 'amber'}
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
                tone="violet"
                count={today.payoutApprovals.count}
                empty="No payout request is waiting for the Admin."
                items={today.payoutApprovals.items.map((r) => ({ key: r.id, href: `/admin/payouts/requests/${r.id}`, title: r.advisorName ?? r.publicRef, meta: r.publicRef, aside: formatInr(r.amountInr) }))}
                footer={today.payoutApprovals.count ? { href: '/admin/payouts/requests?awaitingMe=true', label: 'All awaiting my approval' } : undefined}
              />
              <RailCard
                title="Advisors awaiting review"
                icon={ClipboardCheck}
                tone="sky"
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
      </div>

    <SectionCard
        title="Recent leads"
        icon={ListChecks}
        tone="teal"
        description="Newest in the period · bank values verbatim"
        flush
        actions={
          <Link href="/admin/leads" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            All leads <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <RecentLeadsTable rows={recentLeads} />
        <p className="border-t border-border-subtle px-5 py-2 text-[11px] text-muted-foreground sm:px-6">
          Source: KBS records + latest accepted bank MIS + payout ledger · {rangeLabel} · as of {formatDateTime(home.asOf)}. {home.note}
        </p>
      </SectionCard>
    </div>
  );
}
