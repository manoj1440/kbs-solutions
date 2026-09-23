import { formatDateTime, formatInr, type LeadStatusRow } from '@kbs/shared';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileSpreadsheet,
  ListChecks,
  Phone,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  ActivationBadge,
  DecisionBadge,
  FreshnessLabel,
  ProvenanceChip,
  StageBadge,
} from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { payoutSummarySchema, summarizeBanks, type BankOverview } from '@/lib/admin-overview';
import { ApiError, apiFetch } from '@/lib/api';

export const metadata = { title: 'Business overview · KBS Solutions' };

interface LaunchGate {
  key: string;
  description: string;
  isSet: boolean;
}
interface Distribution {
  telecallers: { id: string; eligible: boolean; active: number; needsReassignment: boolean }[];
  unassigned: number | null;
}
const number = (value: number | null | undefined) =>
  value == null ? 'Unavailable' : value.toLocaleString('en-IN');
const total = (response: { meta: Record<string, unknown> } | null) =>
  typeof response?.meta.total === 'number' ? response.meta.total : null;

function Metric({
  label,
  value,
  detail,
  source,
  href,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  source: string;
  href: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative min-w-0 rounded-2xl border p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-teal-700 ${accent ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${accent ? 'text-teal-100' : 'text-slate-600'}`}>
          {label}
        </span>
        <Icon className={`size-4 ${accent ? 'text-teal-200' : 'text-slate-400'}`} />
      </div>
      <div className="mt-4 truncate text-3xl font-semibold tracking-tight tabular-nums sm:text-[32px]">
        {value}
      </div>
      <p className={`mt-2 text-xs leading-relaxed ${accent ? 'text-teal-100' : 'text-slate-500'}`}>
        {detail}
      </p>
      <div
        className={`mt-5 flex items-center justify-between border-t pt-3 text-[10px] font-semibold tracking-wider uppercase ${accent ? 'border-white/15 text-teal-100' : 'border-slate-100 text-slate-500'}`}
      >
        <span>{source}</span>
        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </Link>
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

/** Executive overview placeholder: the REQ-28 §28.2 launch-gate checklist is live from day one (F-104). */
export default async function AdminOverview() {
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
  const [
    integrity,
    ledger,
    recent,
    approvals,
    approved,
    onboarding,
    distribution,
    advisors,
    managers,
    gates,
  ] = await Promise.all([
    load<{ generatedAt: string; banks: BankOverview[] }>('/dashboards/mis-integrity', 'Bank MIS'),
    load<unknown[]>('/payouts/entitlements?pageSize=1', 'Payout ledger'),
    load<LeadStatusRow[]>('/leads?pageSize=5&sort=createdAt_desc', 'Recent leads'),
    load<unknown[]>('/payouts/requests?awaitingMe=true&pageSize=1', 'Payout approvals'),
    load<unknown[]>('/payouts/requests?state=APPROVED&pageSize=1', 'Approved requests'),
    load<{ userId: string }[]>('/onboarding/review', 'Advisor reviews'),
    load<Distribution>('/calling/distribution', 'Calling operations'),
    load<unknown[]>('/users?role=ADVISOR&status=ACTIVE&pageSize=1', 'Active advisors'),
    load<unknown[]>('/users?role=MANAGER&status=ACTIVE&pageSize=1', 'Active managers'),
    load<LaunchGate[]>('/config/launch-gates', 'Launch readiness'),
  ]);
  const summary = integrity ? summarizeBanks(integrity.data.banks) : null;
  const parsed = payoutSummarySchema.safeParse(ledger?.meta);
  const payouts = parsed.success ? parsed.data : null;
  if (ledger && !payouts) unavailable.push('Payout totals');
  const banks = integrity?.data.banks
    .slice()
    .sort((a, b) => b.leads.total - a.leads.total || a.bank.code.localeCompare(b.bank.code));
  const workingBanks = banks?.filter((b) => b.leads.total > 0 || b.lastUploadAt);
  const inactiveBanks = banks?.filter((b) => b.leads.total === 0 && !b.lastUploadAt);
  const unset = gates?.data.filter((g) => !g.isSet);
  const counts = payouts?.counts;
  const amounts = payouts?.amounts;
  const eligibleCallers = distribution?.data.telecallers.filter((t) => t.eligible).length;
  const assignedRecords = distribution?.data.telecallers.reduce((sum, t) => sum + t.active, 0);
  const fetchedAt = new Date().toISOString();
  const attention = [
    {
      label: 'MIS exceptions',
      detail: 'Unmatched or conflicting rows',
      count: summary?.quarantine,
      href: '/admin/mis/integrity',
      icon: FileSpreadsheet,
    },
    {
      label: 'Payout approvals',
      detail: 'Awaiting your decision',
      count: total(approvals),
      href: '/admin/payouts/requests?awaitingMe=true',
      icon: Wallet,
    },
    {
      label: 'Advisor reviews',
      detail: 'Onboarding awaiting review',
      count: onboarding?.data.length,
      href: '/admin/onboarding',
      icon: Users,
    },
    {
      label: 'Unassigned records',
      detail: 'Calling records needing allocation',
      count: distribution?.data.unassigned,
      href: '/admin/calling-list/distribution',
      icon: Phone,
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-teal-800 uppercase">
            <span className="size-1.5 rounded-full bg-teal-600" />
            Your business at a glance
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[34px]">
            Business overview
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            A clear view of your leads, bank data, people and payouts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="h-10 rounded-lg bg-white">
            <Link href="/admin/leads">
              <ListChecks />
              Explore leads
            </Link>
          </Button>
          <Button asChild className="h-10 rounded-lg">
            <Link href="/admin/mis">
              <ArrowDownToLine />
              Import bank MIS
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5">
          <Building2 className="size-3.5" />
          All banks<span className="text-slate-300">/</span>All time
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" />
          Snapshot fetched {formatDateTime(fetchedAt)} · IST
        </span>
      </div>
      {unavailable.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <strong>Some data could not be loaded.</strong> {unavailable.join(', ')}. Unavailable
          figures are not zero. Use the refresh button to retry.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Leads created"
          value={number(summary?.leads)}
          detail="All submitted advisor leads"
          source="KBS activity"
          href="/admin/leads"
          icon={Users}
        />
        <Metric
          label="MIS-matched leads"
          value={number(summary?.matched)}
          detail={
            summary
              ? `${number(summary.neverMatched)} still awaiting their first match`
              : 'Matching summary unavailable'
          }
          source="Bank MIS"
          href="/admin/mis/integrity"
          icon={FileCheck2}
        />
        <Metric
          label="Eligible card events"
          value={number(counts?.eligible)}
          detail={
            counts
              ? `${number(counts.availableToClaim)} available to claim`
              : 'Eligibility summary unavailable'
          }
          source="MIS + approved payout rules"
          href="/admin/payouts/entitlements"
          icon={ShieldCheck}
        />
        <Metric
          label="Reserved payout value"
          value={amounts ? formatInr(amounts.reserved) : 'Unavailable'}
          detail={
            counts
              ? `${number(counts.reserved)} card event${counts.reserved === 1 ? '' : 's'} in active requests`
              : 'Reservation summary unavailable'
          }
          source="KBS payout ledger · not paid"
          href="/admin/payouts/requests"
          icon={Wallet}
          accent
        />
      </div>

      <section
        aria-labelledby="attention-title"
        className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/70 px-5 py-3">
          <h2
            id="attention-title"
            className="flex items-center gap-2 text-sm font-semibold text-amber-950"
          >
            <CircleAlert className="size-4 text-amber-700" />
            Needs your attention
          </h2>
          <span className="text-xs text-amber-800">Review exceptions before making decisions</span>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {attention.map(({ label, detail, count, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center gap-3 border-b border-slate-100 p-5 hover:bg-slate-50 xl:border-r xl:border-b-0"
            >
              <span className="rounded-lg bg-slate-100 p-2.5 text-slate-600">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${count ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {number(count)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
              </div>
              <ArrowUpRight className="size-3.5 shrink-0 text-slate-400 group-hover:text-teal-700" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0 gap-5">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                <h2>Bank data & coverage</h2>
              </CardTitle>
              <SectionLink href="/admin/mis/integrity">View integrity</SectionLink>
            </div>
            <CardDescription>Matched leads and latest uploads, bank by bank.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex flex-wrap items-center gap-5 rounded-xl bg-slate-50 p-4">
              <div
                className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#0f766e ${(summary?.coverage ?? 0) * 3.6}deg, #e2e8f0 0deg)`,
                }}
              >
                <div className="flex size-[76px] flex-col items-center justify-center rounded-full bg-slate-50">
                  <span className="text-xl font-semibold tabular-nums">
                    {summary?.coverage == null ? '—' : `${summary.coverage}%`}
                  </span>
                  <span className="text-[9px] font-medium tracking-wider text-slate-500 uppercase">
                    Matched
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {summary
                    ? `${number(summary.matched)} of ${number(summary.leads)} leads have MIS evidence`
                    : 'MIS summary unavailable'}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  A match is not an approval. Each bank value stays separate and reflects only the
                  last matched MIS.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Link
                    className="text-amber-800 underline decoration-amber-300 underline-offset-4"
                    href="/admin/leads?misFreshness=older7d"
                  >
                    {number(summary?.stale)} matched over 7 days ago
                  </Link>
                  <span className="text-slate-500">{number(summary?.invalid)} invalid rows</span>
                </div>
              </div>
            </div>
            {workingBanks?.length ? (
              <div className="divide-y divide-slate-100">
                {workingBanks.map((b) => (
                  <div
                    key={b.bank.id}
                    className="grid gap-3 py-3 first:pt-0 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-white text-[10px] font-bold text-slate-600">
                        {b.bank.code.slice(0, 4)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          className="text-sm font-semibold hover:text-teal-700"
                          href={`/admin/leads?bankId=${b.bank.id}`}
                        >
                          {b.bank.displayName}
                        </Link>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {number(b.leads.total - b.leads.neverMatched)} / {number(b.leads.total)}{' '}
                          leads matched
                        </p>
                      </div>
                    </div>
                    <div className="text-xs sm:text-right">
                      <p className="text-slate-600">
                        {b.lastUploadAt
                          ? `Uploaded ${formatDateTime(b.lastUploadAt)}`
                          : 'No MIS uploaded'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {b.lastAppliedAt
                          ? `Applied ${formatDateTime(b.lastAppliedAt)}`
                          : 'No batch applied'}
                      </p>
                      {b.quarantine > 0 ? (
                        <Link
                          href={`/admin/mis/integrity?bankId=${b.bank.id}`}
                          className="mt-1 inline-block text-[11px] font-semibold text-amber-800"
                        >
                          {b.quarantine} {b.quarantine === 1 ? 'row needs' : 'rows need'} resolution
                          →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {integrity
                  ? 'No bank activity yet. Import an MIS to begin matching leads.'
                  : 'Bank coverage could not be loaded.'}
              </p>
            )}
            {inactiveBanks?.length ? (
              <details className="rounded-lg border border-slate-100 px-3 py-2">
                <summary className="cursor-pointer text-xs text-slate-500">
                  {inactiveBanks.length} banks with no leads or MIS uploads
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {inactiveBanks.map((b) => (
                    <Link
                      className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-teal-50"
                      key={b.bank.id}
                      href={`/admin/mis/integrity?bankId=${b.bank.id}`}
                    >
                      {b.bank.displayName} · No upload
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
            <div className="border-t pt-3 text-[10px] text-slate-500">
              Source: Bank MIS · Summary{' '}
              {integrity ? formatDateTime(integrity.data.generatedAt) : 'unavailable'}. Upload time
              is not a bank event date.
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-5">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>
                <h2>Payout positions</h2>
              </CardTitle>
              <SectionLink href="/admin/payouts/entitlements">Open ledger</SectionLink>
            </div>
            <CardDescription>Card-event balances. Approval is not payment.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="divide-y divide-slate-100">
              {(
                [
                  {
                    label: 'Available to claim',
                    key: 'available',
                    state: 'ELIGIBLE_AVAILABLE',
                    color: 'bg-teal-600',
                  },
                  {
                    label: 'Reserved in requests',
                    key: 'reserved',
                    state: 'RESERVED',
                    color: 'bg-blue-600',
                  },
                  {
                    label: 'Paid card events',
                    key: 'paid',
                    state: 'PAID',
                    color: 'bg-emerald-600',
                  },
                  {
                    label: 'Pending hold',
                    key: 'pendingHold',
                    state: 'PENDING_HOLD',
                    color: 'bg-amber-500',
                  },
                  {
                    label: 'Under review',
                    key: 'underReview',
                    state: 'UNDER_REVIEW',
                    color: 'bg-rose-500',
                  },
                ] as const
              ).map(({ label, key, state, color }) => (
                <Link
                  key={key}
                  href={`/admin/payouts/entitlements?state=${state}`}
                  className="flex items-center gap-2.5 py-3 first:pt-0 hover:text-teal-700"
                >
                  <span className={`size-2 shrink-0 rounded-full ${color}`} />
                  <span className="flex-1 text-sm">
                    {label}
                    <span className="ml-2 text-[11px] text-slate-500">
                      {number(counts?.[key])} {counts?.[key] === 1 ? 'event' : 'events'}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {amounts ? formatInr(amounts[key]) : 'Unavailable'}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="/admin/payouts/requests?state=APPROVED"
              className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5"
            >
              <span className="rounded-lg bg-white p-2 text-blue-700">
                <Wallet className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-900">
                  {number(total(approved))} approved{' '}
                  {total(approved) === 1 ? 'request' : 'requests'} awaiting payment
                </p>
                <p className="mt-1 text-[11px] text-blue-800">
                  Both approvals complete. Not yet recorded as paid.
                </p>
              </div>
              <ArrowRight className="size-4 text-blue-700" />
            </Link>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Eligible events include hold, available, reserved and paid positions; they are not
              extra balances to add together. Corrections under review remain separate.
            </p>
            <div className="border-t pt-3 text-[10px] text-slate-500">
              Source: KBS payout ledger + bank MIS / approved rules ·{' '}
              {ledger?.meta.asOf
                ? formatDateTime(String(ledger.meta.asOf))
                : 'Snapshot time unavailable'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 gap-5 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <h2>Recent leads</h2>
            </CardTitle>
            <SectionLink href="/admin/leads">View all leads</SectionLink>
          </div>
          <CardDescription>
            Latest 5 by KBS creation date. Bank stage, decision and activation are independent.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Customer / reference</TableHead>
                <TableHead>Bank & card</TableHead>
                <TableHead>Bank stage</TableHead>
                <TableHead>Decision / activation</TableHead>
                <TableHead className="pr-6">MIS evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent?.data.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="pl-6">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="font-semibold text-slate-800 hover:text-teal-700"
                    >
                      {lead.customer.name}
                    </Link>
                    <p className="mt-1 text-[11px] text-slate-500">{lead.kbsRef}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{lead.bank.displayName}</p>
                    <p className="mt-1 text-xs text-slate-500">{lead.card.name}</p>
                  </TableCell>
                  <TableCell>
                    <div className="w-56 [&_[data-slot=badge]]:shrink [&_[data-slot=badge]]:whitespace-normal [&_[data-slot=badge]]:text-left">
                      <StageBadge field={lead.stage} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-2">
                      <DecisionBadge field={lead.decision} />
                      <ActivationBadge field={lead.activation} />
                    </div>
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="grid justify-items-start gap-2">
                      <ProvenanceChip provenance="BANK_MIS" />
                      <FreshnessLabel lastMatchedAt={lead.lastMatchedAt} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!recent?.data.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                    {recent
                      ? 'No leads yet. Your submitted leads will appear here.'
                      : 'Recent leads could not be loaded. Refresh to retry.'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <h2>People & sales operations</h2>
              </CardTitle>
              <SectionLink href="/admin/users">View team</SectionLink>
            </div>
            <CardDescription>Current staffing and active calling assignments.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Active advisors', value: total(advisors), href: '/admin/users' },
                { label: 'Active managers', value: total(managers), href: '/admin/users' },
                {
                  label: 'Eligible telecallers',
                  value: eligibleCallers,
                  href: '/admin/calling-list/distribution',
                },
                {
                  label: 'Assigned records',
                  value: assignedRecords,
                  href: '/admin/calling-list/distribution',
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-xl bg-slate-50 p-3 hover:bg-teal-50"
                >
                  <span className="text-2xl font-semibold tabular-nums">{number(item.value)}</span>
                  <span className="mt-1.5 block text-[11px] leading-relaxed text-slate-500">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <SectionLink href="/admin/calling-list">Import calling list</SectionLink>
              <SectionLink href="/admin/training/team">Training progress</SectionLink>
              <SectionLink href="/admin/catalogue">Manage card catalogue</SectionLink>
            </div>
            {distribution?.data.telecallers.some((t) => t.needsReassignment) ? (
              <p className="mt-4 text-xs font-medium text-amber-800">
                Some telecallers hold records that need reassignment. Review allocation.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                <h2>Launch readiness</h2>
              </CardTitle>
              <Badge variant={unset?.length === 0 ? 'success' : 'warning'}>
                {unset ? `${unset.length} pending` : 'Unavailable'}
              </Badge>
            </div>
            <CardDescription>
              Required configuration remains visible—not hidden behind business totals.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-9 shrink-0 text-teal-700" />
              <p className="text-sm leading-relaxed text-slate-600">
                {gates && unset
                  ? `${gates.data.length - unset.length} of ${gates.data.length} requirements configured. Review remaining policies before production.`
                  : 'Launch gates could not be loaded.'}
              </p>
            </div>
            <details className="group rounded-xl border border-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-xs font-semibold">
                View configuration checklist
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="grid max-h-72 gap-4 overflow-auto border-t p-4">
                {gates?.data.map((gate) => (
                  <li key={gate.key} className="flex gap-2 text-xs">
                    {gate.isSet ? (
                      <CheckCircle2 className="size-4 shrink-0 text-teal-700" />
                    ) : (
                      <CircleAlert className="size-4 shrink-0 text-amber-700" />
                    )}
                    <div className="min-w-0">
                      <p className="mb-1 break-all font-medium">
                        {gate.key} · {gate.isSet ? 'Configured' : 'Needs configuration'}
                      </p>
                      <p className="leading-relaxed text-slate-500">{gate.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
            <SectionLink href="/admin/config">Review configuration</SectionLink>
          </CardContent>
        </Card>
      </div>
      <footer className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
        <span className="inline-flex max-w-3xl items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Statuses reflect the latest uploaded bank file. Blank values mean “Not reported”; a lead
          without a match is “Awaiting MIS Update”.
        </span>
        <span>All-time snapshot · Not live bank status</span>
      </footer>
    </div>
  );
}
