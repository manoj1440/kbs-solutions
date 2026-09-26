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
  Headset,
  LayoutDashboard,
  ListChecks,
  Phone,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
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
import {
  Avatar,
  BankMark,
  Callout,
  EmptyState,
  IconTile,
  Meter,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  TONE,
  type Tone,
} from '@/components/ui/kit';
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
      tone: 'rose' as Tone,
    },
    {
      label: 'Payout approvals',
      detail: 'Awaiting your decision',
      count: total(approvals),
      href: '/admin/payouts/requests?awaitingMe=true',
      icon: Wallet,
      tone: 'amber' as Tone,
    },
    {
      label: 'Advisor reviews',
      detail: 'Onboarding awaiting review',
      count: onboarding?.data.length,
      href: '/admin/onboarding',
      icon: Users,
      tone: 'violet' as Tone,
    },
    {
      label: 'Unassigned records',
      detail: 'Calling records needing allocation',
      count: distribution?.data.unassigned,
      href: '/admin/calling-list/distribution',
      icon: Phone,
      tone: 'sky' as Tone,
    },
  ];

  const payoutRows = [
    { label: 'Available to claim', key: 'available', state: 'ELIGIBLE_AVAILABLE', tone: 'teal' },
    { label: 'Reserved in requests', key: 'reserved', state: 'RESERVED', tone: 'indigo' },
    { label: 'Paid card events', key: 'paid', state: 'PAID', tone: 'emerald' },
    { label: 'Pending hold', key: 'pendingHold', state: 'PENDING_HOLD', tone: 'amber' },
    { label: 'Under review', key: 'underReview', state: 'UNDER_REVIEW', tone: 'rose' },
  ] as const;
  const largestAmount = amounts ? Math.max(...payoutRows.map((r) => amounts[r.key])) : 0;
  const openAttention = attention.filter((a) => a.count).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={LayoutDashboard}
        eyebrow="Workspace"
        title="Business overview"
        description="A clear view of your leads, bank data, people and payouts."
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
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600">
              <Building2 className="size-3.5" />
              All banks<span className="text-slate-300">/</span>All time
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              Snapshot fetched {formatDateTime(fetchedAt)} · IST
            </span>
          </>
        }
      >
        {unavailable.length > 0 ? (
          <Callout tone="warning" icon={TriangleAlert} role="alert" title="Some data could not be loaded.">
            {unavailable.join(', ')}. Unavailable figures are not zero. Use the refresh button to retry.
          </Callout>
        ) : null}
        <StatGrid>
          <StatCard
            label="Leads created"
            value={number(summary?.leads)}
            hint="All submitted advisor leads"
            source="KBS activity"
            href="/admin/leads"
            icon={Users}
            tone="sky"
          />
          <StatCard
            label="MIS-matched leads"
            value={number(summary?.matched)}
            hint={
              summary
                ? `${number(summary.neverMatched)} still awaiting their first match`
                : 'Matching summary unavailable'
            }
            source="Bank MIS"
            href="/admin/mis/integrity"
            icon={FileCheck2}
            tone="indigo"
          />
          <StatCard
            label="Eligible card events"
            value={number(counts?.eligible)}
            hint={
              counts
                ? `${number(counts.availableToClaim)} available to claim`
                : 'Eligibility summary unavailable'
            }
            source="MIS + approved payout rules"
            href="/admin/payouts/entitlements"
            icon={ShieldCheck}
            tone="emerald"
          />
          <StatCard
            label="Reserved payout value"
            value={amounts ? formatInr(amounts.reserved) : 'Unavailable'}
            hint={
              counts
                ? `${number(counts.reserved)} card event${counts.reserved === 1 ? '' : 's'} in active requests`
                : 'Reservation summary unavailable'
            }
            source="KBS payout ledger · not paid"
            href="/admin/payouts/requests"
            icon={Wallet}
            emphasis
          />
        </StatGrid>
      </PageHeader>

      <section
        aria-labelledby="attention-title"
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <IconTile icon={CircleAlert} tone={openAttention ? 'amber' : 'emerald'} size="sm" />
            <div>
              <h2 id="attention-title" className="text-[15px] leading-6 font-semibold tracking-tight text-slate-900">
                Needs your attention
              </h2>
              <p className="text-[12.5px] text-slate-500">Review exceptions before making decisions</p>
            </div>
          </div>
          <Badge variant={openAttention ? 'warning' : 'success'}>
            {openAttention ? `${openAttention} of ${attention.length} queues open` : 'All queues clear'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
          {attention.map(({ label, detail, count, href, icon, tone }) => (
            <Link
              key={label}
              href={href}
              prefetch={false}
              className="group relative flex items-start gap-3 bg-white p-5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700"
            >
              {count ? <span className={`absolute inset-x-0 top-0 h-0.5 ${TONE[tone].bar}`} aria-hidden="true" /> : null}
              <IconTile icon={icon} tone={count ? tone : 'slate'} size="sm" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`text-xl leading-7 font-semibold tabular-nums ${count ? TONE[tone].text : 'text-slate-400'}`}
                >
                  {number(count)}
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-700" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          icon={FileSpreadsheet}
          tone="indigo"
          title="Bank data & coverage"
          description="Matched leads and latest uploads, bank by bank."
          actions={<SectionLink href="/admin/mis/integrity">View integrity</SectionLink>}
          bodyClassName="grid gap-5"
        >
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 ring-1 ring-slate-100">
            <div
              className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#0f766e ${(summary?.coverage ?? 0) * 3.6}deg, #e2e8f0 0deg)`,
              }}
            >
              <div className="flex size-[76px] flex-col items-center justify-center rounded-full bg-white">
                <span className="text-xl font-semibold tabular-nums">
                  {summary?.coverage == null ? '—' : `${summary.coverage}%`}
                </span>
                <span className="text-[9px] font-medium tracking-wider text-slate-500 uppercase">
                  Matched
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-sm font-semibold text-slate-900">
                {summary
                  ? `${number(summary.matched)} of ${number(summary.leads)} leads have MIS evidence`
                  : 'MIS summary unavailable'}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                A match is not an approval. Each bank value stays separate and reflects only the
                last matched MIS.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-amber-200 ring-inset hover:bg-amber-100"
                  href="/admin/leads?misFreshness=older7d"
                >
                  <Clock3 className="size-3" />
                  {number(summary?.stale)} matched over 7 days ago
                </Link>
                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200 ring-inset">
                  {number(summary?.invalid)} invalid rows
                </span>
              </div>
            </div>
          </div>
          {workingBanks?.length ? (
            <ul className="divide-y divide-slate-100">
              {workingBanks.map((b) => {
                const matched = b.leads.total - b.leads.neverMatched;
                return (
                  <li key={b.bank.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]">
                    <div className="flex min-w-0 items-center gap-3">
                      <BankMark code={b.bank.code} />
                      <div className="min-w-0 flex-1">
                        <Link
                          className="text-sm font-semibold text-slate-900 hover:text-teal-700"
                          href={`/admin/leads?bankId=${b.bank.id}`}
                        >
                          {b.bank.displayName}
                        </Link>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Meter
                            value={matched}
                            max={b.leads.total}
                            tone="indigo"
                            className="h-1.5 max-w-40"
                            label={`${b.bank.displayName} leads matched`}
                          />
                          <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                            {number(matched)} / {number(b.leads.total)} leads matched
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs sm:text-right">
                      <p className="text-slate-600">
                        {b.lastUploadAt ? `Uploaded ${formatDateTime(b.lastUploadAt)}` : 'No MIS uploaded'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {b.lastAppliedAt ? `Applied ${formatDateTime(b.lastAppliedAt)}` : 'No batch applied'}
                      </p>
                      {b.quarantine > 0 ? (
                        <Link
                          href={`/admin/mis/integrity?bankId=${b.bank.id}`}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset"
                        >
                          {b.quarantine} {b.quarantine === 1 ? 'row needs' : 'rows need'} resolution
                          →
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={FileSpreadsheet}
              title={integrity ? 'No bank activity yet' : 'Bank coverage unavailable'}
              description={
                integrity
                  ? 'No bank activity yet. Import an MIS to begin matching leads.'
                  : 'Bank coverage could not be loaded.'
              }
            />
          )}
          {inactiveBanks?.length ? (
            <details className="group rounded-xl border border-slate-200/80 px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs text-slate-500">
                {inactiveBanks.length} banks with no leads or MIS uploads
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {inactiveBanks.map((b) => (
                  <Link
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pr-2.5 pl-1 text-xs text-slate-600 hover:bg-teal-50"
                    key={b.bank.id}
                    href={`/admin/mis/integrity?bankId=${b.bank.id}`}
                  >
                    <BankMark code={b.bank.code} size="sm" className="h-6 min-w-6 opacity-70" />
                    {b.bank.displayName} · No upload
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
          <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-500">
            Source: Bank MIS · Summary{' '}
            {integrity ? formatDateTime(integrity.data.generatedAt) : 'unavailable'}. Upload time is
            not a bank event date.
          </div>
        </SectionCard>

        <SectionCard
          icon={Wallet}
          tone="teal"
          title="Payout positions"
          description="Card-event balances. Approval is not payment."
          actions={<SectionLink href="/admin/payouts/entitlements">Open ledger</SectionLink>}
          bodyClassName="grid gap-4"
        >
          <div className="divide-y divide-slate-100">
            {payoutRows.map(({ label, key, state, tone }) => (
              <Link
                key={key}
                href={`/admin/payouts/entitlements?state=${state}`}
                className="group grid gap-2 py-3 first:pt-0"
              >
                <span className="flex items-center gap-2.5">
                  <span className={`size-2 shrink-0 rounded-full ${TONE[tone].bar}`} />
                  <span className="flex-1 text-sm text-slate-800 group-hover:text-teal-700">
                    {label}
                    <span className="ml-2 text-[11px] text-slate-500">
                      {number(counts?.[key])} {counts?.[key] === 1 ? 'event' : 'events'}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {amounts ? formatInr(amounts[key]) : 'Unavailable'}
                  </span>
                </span>
                {amounts?.[key] ? (
                  <Meter value={amounts[key]} max={largestAmount} tone={tone} className="ml-4.5 h-1 w-auto" label={label} />
                ) : null}
              </Link>
            ))}
          </div>
          <Link
            href="/admin/payouts/requests?state=APPROVED"
            className="group flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3.5 hover:bg-sky-100/70"
          >
            <IconTile icon={Wallet} tone="sky" size="sm" className="bg-white" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sky-950">
                {number(total(approved))} approved{' '}
                {total(approved) === 1 ? 'request' : 'requests'} awaiting payment
              </p>
              <p className="mt-1 text-[11px] text-sky-800">
                Both approvals complete. Not yet recorded as paid.
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-sky-700 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Eligible events include hold, available, reserved and paid positions; they are not
            extra balances to add together. Corrections under review remain separate.
          </p>
          <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-500">
            Source: KBS payout ledger + bank MIS / approved rules ·{' '}
            {ledger?.meta.asOf ? formatDateTime(String(ledger.meta.asOf)) : 'Snapshot time unavailable'}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        icon={ListChecks}
        tone="sky"
        title="Recent leads"
        description="Latest 5 by KBS creation date. Bank stage, decision and activation are independent."
        actions={<SectionLink href="/admin/leads">View all leads</SectionLink>}
        flush={!!recent?.data.length}
      >
        {recent?.data.length ? (
          <Table responsive>
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
              {recent.data.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="pl-6" data-label="Customer / reference">
                    <div className="flex items-center gap-3">
                      <Avatar name={lead.customer.name} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="font-semibold text-slate-800 hover:text-teal-700"
                        >
                          {lead.customer.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{lead.kbsRef}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="Bank & card">
                    <div className="flex items-center gap-2.5">
                      {/* lead rows carry no bank code; first word of the name matches the code for current banks */}
                      <BankMark code={lead.bank.displayName.split(' ')[0].toUpperCase()} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">{lead.bank.displayName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{lead.card.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="Bank stage">
                    <div className="max-w-56">
                      <StageBadge field={lead.stage} />
                    </div>
                  </TableCell>
                  <TableCell data-label="Decision / activation">
                    <div className="grid justify-items-start gap-2">
                      <DecisionBadge field={lead.decision} />
                      <ActivationBadge field={lead.activation} />
                    </div>
                  </TableCell>
                  <TableCell className="pr-6" data-label="MIS evidence">
                    <div className="grid justify-items-start gap-2">
                      <ProvenanceChip provenance="BANK_MIS" />
                      <FreshnessLabel lastMatchedAt={lead.lastMatchedAt} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={ListChecks}
            title={recent ? 'No leads yet' : 'Recent leads unavailable'}
            description={
              recent
                ? 'No leads yet. Your submitted leads will appear here.'
                : 'Recent leads could not be loaded. Refresh to retry.'
            }
          />
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          icon={Users}
          tone="violet"
          title="People & sales operations"
          description="Current staffing and active calling assignments."
          actions={<SectionLink href="/admin/users">View team</SectionLink>}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { label: 'Active advisors', value: total(advisors), href: '/admin/users', icon: Users, tone: 'violet' },
                { label: 'Active managers', value: total(managers), href: '/admin/users', icon: UserCog, tone: 'indigo' },
                {
                  label: 'Eligible telecallers',
                  value: eligibleCallers,
                  href: '/admin/calling-list/distribution',
                  icon: Headset,
                  tone: 'sky',
                },
                {
                  label: 'Assigned records',
                  value: assignedRecords,
                  href: '/admin/calling-list/distribution',
                  icon: Phone,
                  tone: 'teal',
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="lift grid gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 hover:bg-white"
              >
                <IconTile icon={item.icon} tone={item.tone} size="sm" className="size-7 [&>svg]:size-3.5" />
                <span className="text-2xl font-semibold tabular-nums">{number(item.value)}</span>
                <span className="text-[11px] leading-relaxed text-slate-500">{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <SectionLink href="/admin/calling-list">Import calling list</SectionLink>
            <SectionLink href="/admin/training/team">Training progress</SectionLink>
            <SectionLink href="/admin/catalogue">Manage card catalogue</SectionLink>
          </div>
          {distribution?.data.telecallers.some((t) => t.needsReassignment) ? (
            <Callout tone="warning" icon={TriangleAlert} className="mt-4">
              Some telecallers hold records that need reassignment. Review allocation.
            </Callout>
          ) : null}
        </SectionCard>
        <SectionCard
          icon={ShieldCheck}
          tone={unset?.length === 0 ? 'emerald' : 'amber'}
          title="Launch readiness"
          description="Required configuration remains visible—not hidden behind business totals."
          actions={
            <Badge variant={unset?.length === 0 ? 'success' : 'warning'}>
              {unset ? `${unset.length} pending` : 'Unavailable'}
            </Badge>
          }
          bodyClassName="grid gap-4"
        >
          <div className="grid gap-2.5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <p className="text-sm leading-relaxed text-slate-600">
              {gates && unset
                ? `${gates.data.length - unset.length} of ${gates.data.length} requirements configured. Review remaining policies before production.`
                : 'Launch gates could not be loaded.'}
            </p>
            {gates && unset ? (
              <Meter
                value={gates.data.length - unset.length}
                max={gates.data.length}
                tone={unset.length === 0 ? 'emerald' : 'teal'}
                label="Requirements configured"
              />
            ) : null}
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
                    <p className="mb-1 font-medium break-all">
                      {gate.key} · {gate.isSet ? 'Configured' : 'Needs configuration'}
                    </p>
                    <p className="leading-relaxed text-slate-500">{gate.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
          <SectionLink href="/admin/config">Review configuration</SectionLink>
        </SectionCard>
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
