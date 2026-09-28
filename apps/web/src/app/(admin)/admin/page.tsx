import { type CallingRecordsSummary, formatDateTime, formatInr, type LeadStatusRow } from '@kbs/shared';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Calculator,
  CalendarClock,
  CreditCard,
  FilePlus2,
  Headset,
  Inbox,
  Landmark,
  ListChecks,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Send,
  Sparkles,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActivationBadge, DecisionBadge, StageBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BankMark, Callout, EmptyState, IconTile, Meter, MiniStat, PillNav, selectClass, TONE, type Tone } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERIODS, resolvePeriod } from '@/lib/admin-overview';
import { ApiError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Business overview · KBS Solutions' };

interface Metric {
  value: number;
  amountInr?: number;
}
interface Dist {
  buckets: { value: string; count: number }[];
}
interface CallerRow {
  user: { id: string; fullName: string; status: string };
  records: { assigned: Metric; active: Metric };
  calls: { attempts: Metric; connected: Metric };
  callbacks: { due: Metric; completed: Metric };
  shares: { total: Metric };
  outcomes: Record<string, Metric | undefined>;
}
interface Home {
  range: { from: string | null; to: string | null };
  people: Record<'TELECALLER' | 'MANAGER' | 'ADVISOR' | 'ACCOUNTS', { total: number; active: number }>;
  catalogue: { banks: { total: number; active: number }; cards: { total: number; published: number } };
  cumulative: {
    mis: { total: number; approved: number; declined: number; inProcess: number; decisionBlank: number; cardsActive: number; cardsInactive: number; activationBlank: number };
    leads: { total: number; matched: number; awaitingMis: number };
    payouts: { eligible: { count: number; amountInr: number }; paid: { count: number; amountInr: number } };
  };
  business: {
    leads: { created: Metric; misMatched: Metric; awaitingMis: Metric };
    approved: number;
    activated: number;
    declined: number;
    inProcess: number;
    decision: Dist;
    activation: Dist;
    payouts: { eligible: Metric; paid: Metric };
  };
  calling: {
    records: Record<string, Metric>;
    calls: { attempts: Metric; failedBeforeProvider: Metric; connected: Metric; notAnswered: Metric; failed: Metric; uniqueCustomersContacted: Metric };
    callbacks: { due: Metric; completed: Metric };
    outcomes: Record<string, Metric | undefined>;
    shares: { total: Metric; delivered: Metric };
    byCaller: CallerRow[];
    pipeline: CallingRecordsSummary;
  };
  recentLeads: LeadStatusRow[];
  asOf: string;
  note: string;
  dateBases: Record<string, string>;
}

/** Outcomes that mean the customer showed interest (CallOutcome enum). */
const INTERESTED_OUTCOMES = ['CONNECTED_INTERESTED', 'CONNECTED_LINK_OR_PDF_SHARED'] as const;
const interested = (outcomes: Record<string, Metric | undefined>) => INTERESTED_OUTCOMES.reduce((n, k) => n + (outcomes[k]?.value ?? 0), 0);

const day = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/** Tinted stat tile: icon + label on top, tone-coloured value, optional share-of-total meter. */
function Stat({ label, value, hint, icon, tone, href, share, big }: { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone: Tone; href?: string; share?: { value: number; max: number }; big?: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] leading-tight font-medium text-slate-600">{label}</span>
        <IconTile icon={icon} tone={tone} size="sm" />
      </div>
      <div className={cn('mt-1.5 font-semibold tracking-tight tabular-nums', big ? 'text-3xl' : 'text-2xl', TONE[tone].text)}>{value}</div>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      {share ? <Meter value={share.value} max={Math.max(1, share.max)} tone={tone} className="mt-2 h-1.5" label={label} /> : null}
    </>
  );
  const cls = cn('group block rounded-2xl p-3.5 ring-1 ring-slate-200/70 ring-inset transition-shadow', TONE[tone].soft, href && 'hover:shadow-md hover:ring-slate-300');
  return href ? (
    <Link href={href} prefetch={false} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({ title, caption, icon, tone, href, linkLabel, children }: { title: string; caption: string; icon: LucideIcon; tone: Tone; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <IconTile icon={icon} tone={tone} size="sm" />
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
        <span className="min-w-0 text-xs text-slate-500">{caption}</span>
        <Link href={href} className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-800 hover:underline">
          {linkLabel}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}

/**
 * F-811 Business overview: the Admin home. Per-date-range business figures (leads → MIS → cards activated → payout)
 * and calling performance, plus all-time context and the newest leads. Bank figures are the latest accepted MIS
 * values as reported (INV-01..03); every tile names its source.
 */
export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const qs = new URLSearchParams();
  if (period.current.from) qs.set('from', period.current.from);
  if (period.current.to) qs.set('to', period.current.to);
  const qsStr = qs.toString();
  let home: Home;
  try {
    home = (await apiFetch<Home>(`/dashboards/admin/home${qsStr ? `?${qsStr}` : ''}`)).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login?next=%2Fadmin');
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Business overview</h1>
        <Callout tone="warning" icon={TriangleAlert} role="alert" title="Dashboard data could not be loaded.">
          Refresh to retry. Unavailable figures are not zero.
        </Callout>
      </div>
    );
  }

  const { people, cumulative, business, calling, recentLeads } = home;
  const pipeline = calling.pipeline;
  const chipHref = (key: string) => `/admin?period=${key}`;
  const activeChip = period.key === 'custom' ? '' : chipHref(period.key);
  const rangeLabel = home.range.from || home.range.to ? `${home.range.from ? day(home.range.from) : '…'} – ${home.range.to ? day(home.range.to) : 'today'}` : 'All time';
  const teamPills: { label: string; role: keyof typeof people; href: string; icon: LucideIcon; tone: Tone }[] = [
    { label: 'Telecallers', role: 'TELECALLER', href: '/admin/users?role=TELECALLER', icon: Headset, tone: 'sky' },
    { label: 'Managers', role: 'MANAGER', href: '/admin/users?role=MANAGER', icon: UserCog, tone: 'indigo' },
    { label: 'Advisors', role: 'ADVISOR', href: '/admin/users?role=ADVISOR', icon: BriefcaseBusiness, tone: 'violet' },
    { label: 'Accounts', role: 'ACCOUNTS', href: '/admin/users?role=ACCOUNTS', icon: Calculator, tone: 'slate' },
  ];
  const callers = [...calling.byCaller].sort((a, b) => b.calls.attempts.value - a.calls.attempts.value || a.user.fullName.localeCompare(b.user.fullName));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Business overview</h1>
        <PillNav label="Period" items={PERIODS.map((p) => ({ href: chipHref(p.key), label: p.label }))} active={activeChip} />
        <form action="/admin" className="flex items-center gap-1.5">
          <input type="date" name="from" aria-label="From" defaultValue={sp.from ?? period.current.from ?? ''} className={cn(selectClass, 'h-8 w-36 px-2 text-xs')} />
          <span className="text-xs text-slate-400">–</span>
          <input type="date" name="to" aria-label="To" defaultValue={sp.to ?? period.current.to ?? ''} className={cn(selectClass, 'h-8 w-36 px-2 text-xs')} />
          <Button type="submit" size="sm" className="h-8">
            Apply
          </Button>
        </form>
        <span className="ml-auto text-[11px] text-slate-500">
          {rangeLabel} · as of {formatDateTime(home.asOf)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {teamPills.map((t) => (
          <Link key={t.role} href={t.href} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-slate-200 hover:ring-teal-300">
            <IconTile icon={t.icon} tone={t.tone} size="sm" />
            <b className="tabular-nums">{people[t.role].total}</b> {t.label} <span className="text-slate-400">· {people[t.role].active} active</span>
          </Link>
        ))}
      </div>

      <Panel title="Business" caption="Leads created in the period → latest bank MIS result · payout by eligible date" icon={Landmark} tone="emerald" href="/admin/leads" linkLabel="All leads">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat big label="Leads created" value={business.leads.created.value} hint={`${business.leads.misMatched.value} matched in bank MIS · ${business.leads.awaitingMis.value} awaiting`} icon={FilePlus2} tone="sky" share={{ value: business.leads.misMatched.value, max: business.leads.created.value }} />
          <Stat big label="Bank approved" value={business.approved} hint={`${business.declined} declined · ${business.inProcess} in process`} icon={BadgeCheck} tone="emerald" share={{ value: business.approved, max: business.leads.created.value }} />
          <Stat big label="Cards activated" value={business.activated} hint="Bank MIS · activation" icon={CreditCard} tone="teal" share={{ value: business.activated, max: business.leads.created.value }} />
          <Stat big label="Payout earned" value={formatInr(business.payouts.eligible.amountInr ?? 0)} hint={`${business.payouts.eligible.value} card events · ${formatInr(business.payouts.paid.amountInr ?? 0)} paid`} icon={Wallet} tone="amber" href="/admin/payouts/entitlements" />
        </div>
        <p className="mt-4 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">All time</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Applications reported" value={cumulative.mis.total} hint="Latest bank-reported state per application" href="/admin/mis" tone="sky" />
          <MiniStat label="Approved" value={cumulative.mis.approved} hint={`${cumulative.mis.declined} declined · ${cumulative.mis.inProcess} in process`} tone="emerald" />
          <MiniStat label="Cards active" value={cumulative.mis.cardsActive} hint={`${cumulative.mis.cardsInactive} inactive · ${cumulative.mis.activationBlank} not reported`} tone="teal" />
          <MiniStat label="Payout earned" value={formatInr(cumulative.payouts.eligible.amountInr)} hint={`${formatInr(cumulative.payouts.paid.amountInr)} paid`} href="/admin/payouts/entitlements" tone="amber" />
        </div>
      </Panel>

      <Panel
        title="Calling performance"
        caption={`${pipeline.total} records · ${pipeline.byStatus.UNTOUCHED} not yet called · ${pipeline.byStatus.UNASSIGNED} waiting for a caller · ${pipeline.followUpsDue} follow-ups due now`}
        icon={PhoneCall}
        tone="sky"
        href="/admin/calling-list/performance"
        linkLabel="Caller performance"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Call attempts" value={calling.calls.attempts.value} hint={`${calling.calls.failedBeforeProvider.value} failed before dialling`} icon={PhoneOutgoing} tone="indigo" />
          <Stat label="Connected" value={calling.calls.connected.value} icon={PhoneCall} tone="emerald" share={{ value: calling.calls.connected.value, max: calling.calls.attempts.value }} />
          <Stat label="Not answered" value={calling.calls.notAnswered.value} icon={PhoneMissed} tone="amber" share={{ value: calling.calls.notAnswered.value, max: calling.calls.attempts.value }} />
          <Stat label="Failed" value={calling.calls.failed.value} icon={PhoneOff} tone="rose" share={{ value: calling.calls.failed.value, max: calling.calls.attempts.value }} />
          <Stat label="Customers contacted" value={calling.calls.uniqueCustomersContacted.value} hint="distinct records reached" icon={Users} tone="sky" />
          <Stat label="Interested" value={interested(calling.outcomes)} hint="Furthest KBS-known step" icon={Sparkles} tone="teal" />
          <Stat label="Links / PDFs shared" value={calling.shares.total.value} hint={`${calling.shares.delivered.value} delivered`} icon={Send} tone="violet" />
          <Stat label="Callbacks" value={calling.callbacks.completed.value} hint={`${calling.callbacks.due.value} due`} icon={CalendarClock} tone="slate" />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-slate-200/70">
          {callers.length === 0 ? (
            <EmptyState icon={Users} title="No callers." description="No telecallers on the team yet." />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0!">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Caller</TableHead>
                  <TableHead className="sm:text-right">Records held</TableHead>
                  <TableHead className="sm:text-right">Attempts</TableHead>
                  <TableHead className="sm:text-right">Connected</TableHead>
                  <TableHead className="sm:text-right">Interested</TableHead>
                  <TableHead className="sm:text-right">Shares</TableHead>
                  <TableHead className="pr-4 sm:text-right">Callbacks done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callers.map((r) => (
                  <TableRow key={r.user.id} className="hover:bg-slate-50">
                    <TableCell className="pl-4" data-label="Caller">
                      <span className="text-xs font-medium text-slate-800">{r.user.fullName}</span>
                      {r.user.status !== 'ACTIVE' ? <Badge variant="secondary" className="ml-2">{r.user.status}</Badge> : null}
                    </TableCell>
                    <TableCell data-label="Records held" className="text-xs tabular-nums sm:text-right">
                      {r.records.assigned.value}
                    </TableCell>
                    <TableCell data-label="Attempts" className="text-xs tabular-nums sm:text-right">
                      {r.calls.attempts.value}
                    </TableCell>
                    <TableCell data-label="Connected" className="text-xs tabular-nums sm:text-right">
                      {r.calls.connected.value}
                    </TableCell>
                    <TableCell data-label="Interested" className="text-xs tabular-nums sm:text-right">
                      {interested(r.outcomes)}
                    </TableCell>
                    <TableCell data-label="Shares" className="text-xs tabular-nums sm:text-right">
                      {r.shares.total.value}
                    </TableCell>
                    <TableCell data-label="Callbacks done" className="pr-4 text-xs tabular-nums sm:text-right">
                      {r.callbacks.completed.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Panel>

      <section aria-label="Recent leads" className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
          <IconTile icon={ListChecks} tone="teal" size="sm" />
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Recent leads</h2>
          <span className="text-xs text-slate-500">Newest in the period · bank values verbatim</span>
          <Link href="/admin/leads" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline">
            All leads
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        {recentLeads.length === 0 ? (
          <EmptyState icon={Inbox} className="m-3" title="No leads created in this period." description="Widen the date range or check All time." />
        ) : (
          <Table responsive containerClassName="rounded-none! border-0!">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead>Bank / card</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Card activation</TableHead>
                <TableHead className="pr-4">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.map((l) => (
                <TableRow key={l.id} className="hover:bg-slate-50">
                  <TableCell className="pl-4" data-label="Customer">
                    <Link href={`/admin/leads/${l.id}`} className="text-xs font-medium text-teal-700 hover:underline">
                      {l.customer.name}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {l.kbsRef}
                      {l.customer.mobileMasked ? ` · ${l.customer.mobileMasked}` : ''}
                    </div>
                  </TableCell>
                  <TableCell data-label="Bank / card">
                    <span className="inline-flex items-center gap-2">
                      <BankMark code={l.bank.code} size="sm" />
                      <span className="text-xs font-medium text-slate-700">{l.bank.code}</span>
                    </span>
                    <div className="mt-0.5 max-w-40 truncate text-[11px] text-slate-500">{l.card.name}</div>
                  </TableCell>
                  <TableCell data-label="Stage">
                    <StageBadge field={l.stage} label={null} />
                  </TableCell>
                  <TableCell data-label="Decision">
                    <DecisionBadge field={l.decision} label={null} />
                  </TableCell>
                  <TableCell data-label="Card activation">
                    <ActivationBadge field={l.activation} label={null} />
                  </TableCell>
                  <TableCell className="pr-4" data-label="Created">
                    <div className="text-xs text-slate-700">{formatDateTime(l.leadCreatedAt)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{l.lastMatchedAt ? `MIS ${formatDateTime(l.lastMatchedAt)}` : 'Awaiting MIS'}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500">
          Source: KBS records + latest accepted bank MIS + payout ledger · as of {formatDateTime(home.asOf)}. {home.note}
        </p>
      </section>
    </div>
  );
}
