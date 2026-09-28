import { formatDate, type LeadStatusRow } from '@kbs/shared';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  GitBranch,
  Info,
  ListChecks,
  type LucideIcon,
  MessageSquareWarning,
  PauseCircle,
  Scale,
  SearchCheck,
  Send,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { EntitlementDto } from '@/components/entitlements-table';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  Callout,
  EmptyState,
  humanize,
  KeyValueGrid,
  Meter,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusDot,
  type Tone,
} from '@/components/ui/kit';
import {
  type AdvisorTeamResponse,
  type Distribution,
  inr,
  type Metric,
  REPORTING_LABEL,
  SOURCE_LABEL,
} from '@/lib/advisor-team';
import { ApiError, apiFetch } from '@/lib/api';

import { type AdvisorRequestRow, AdvisorLeadsTable, AdvisorRequestsTable, AdvisorEntitlementsTable } from './advisor-detail-tables';


function Tile({
  label,
  m,
  money,
  icon,
  tone,
  emphasis,
}: {
  label: string;
  m: Metric;
  money?: boolean;
  icon: LucideIcon;
  tone: Tone;
  emphasis?: boolean;
}) {
  return (
    <StatCard
      label={label}
      value={m.value}
      hint={
        money || m.denominator ? (
          <>
            {money ? <span className="font-medium tabular-nums">{inr(m.amountInr)}</span> : null}
            {money && m.denominator ? ' · ' : null}
            {m.denominator ? `of ${m.denominator.value} ${m.denominator.label}` : null}
          </>
        ) : null
      }
      source={SOURCE_LABEL[m.source] ?? m.source}
      icon={icon}
      tone={tone}
      emphasis={emphasis}
    />
  );
}

function Dist({ title, d, icon }: { title: string; d: Distribution; icon: LucideIcon }) {
  return (
    <SectionCard
      icon={icon}
      tone="indigo"
      title={title}
      description={
        <>
          Bank MIS values verbatim · <span className="tabular-nums">{d.denominator.value}</span>{' '}
          {d.denominator.label}
        </>
      }
    >
      {d.buckets.length ? (
        <ul className="grid gap-3 text-sm">
          {d.buckets.map((b) => {
            const muted = b.value === 'Awaiting MIS' || b.value === 'Not reported';
            return (
              <li key={b.value} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={
                      muted
                        ? 'text-slate-500 italic'
                        : 'min-w-0 font-mono text-[13px] break-words text-slate-800'
                    }
                  >
                    {b.value}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">{b.count}</span>
                </div>
                <Meter
                  value={b.count}
                  max={d.denominator.value}
                  tone={muted ? 'slate' : 'indigo'}
                  className="h-1.5"
                  label={`${b.value}: ${b.count} of ${d.denominator.value}`}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={icon} title="No leads in this range." className="py-6" />
      )}
    </SectionCard>
  );
}

/** F-315: one Advisor's leads, bank results and payout history for their Manager (REQ-15 §15.3). Read-only evidence. */
export default async function ManagerAdvisorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams({ advisorId: id });
  for (const k of ['from', 'to', 'bankId'] as const) if (sp[k]) qs.set(k, sp[k] as string);
  let data: AdvisorTeamResponse;
  try {
    data = (await apiFetch<AdvisorTeamResponse>(`/dashboards/manager/advisors?${qs.toString()}`))
      .data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const row = data.rows[0];
  if (!row) notFound();
  const [leads, requests, ents] = await Promise.all([
    apiFetch<LeadStatusRow[]>(`/leads?advisorId=${id}&pageSize=10`),
    apiFetch<AdvisorRequestRow[]>(`/payouts/requests?advisorId=${id}&pageSize=20`),
    apiFetch<EntitlementDto[]>(`/payouts/entitlements?advisorId=${id}&pageSize=20`),
  ]);
  const p = row.payouts;
  return (
    <div className="grid min-w-0 gap-6">
      <Link
        href="/manager/advisors"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Advisors
      </Link>

      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgb(139_92_246/10%),transparent_65%)]"
        />
        <div className="relative grid gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar
              name={row.user.fullName || row.user.publicRef}
              size="lg"
              className="shadow-sm ring-4 ring-white"
            />
            <PageHeader
              eyebrow="Team · Advisor"
              tone="violet"
              title={row.user.fullName || '(onboarding)'}
              meta={
                <>
                  <StatusDot tone={row.user.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                    {humanize(row.user.status)}
                  </StatusDot>
                  <span className="font-mono text-slate-500">{row.user.publicRef}</span>
                </>
              }
            />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <KeyValueGrid
              cols={4}
              className="grid-cols-2"
              items={[
                [
                  'Mobile',
                  <span key="m" className="font-mono">
                    {row.user.mobileMasked ?? '—'}
                  </span>,
                ],
                ['Joined', formatDate(row.user.joinedAt)],
                [
                  'Reporting line',
                  row.reporting
                    ? `${REPORTING_LABEL[row.reporting.source] ?? row.reporting.source}${row.reporting.agentCode ? ` ${row.reporting.agentCode}` : ''}`
                    : '—',
                ],
                ['Since', row.reporting ? formatDate(row.reporting.since) : '—'],
              ]}
            />
          </div>
        </div>
      </section>

      <StatGrid>
        <Tile label="Leads created" m={row.leads.created} icon={ListChecks} tone="teal" emphasis />
        <Tile
          label="Matched in bank MIS"
          m={row.leads.misMatched}
          icon={FileCheck2}
          tone="indigo"
        />
        <Tile label="Eligible card events" m={p.eligible} money icon={SearchCheck} tone="indigo" />
        <Tile label="Paid card events" m={p.paid} money icon={CheckCircle2} tone="emerald" />
        <Tile label="Available to claim" m={p.available} money icon={Wallet} tone="teal" />
        <Tile label="Requested" m={p.requested} money icon={Send} tone="sky" />
        <Tile label="Approved, unpaid" m={p.approvedUnpaid} money icon={Clock} tone="amber" />
        <Tile label="On hold" m={p.onHold} money icon={PauseCircle} tone="slate" />
      </StatGrid>
      <Callout tone={row.awaitingManagerApproval ? 'warning' : 'neutral'} icon={Info}>
        {data.meta.note} Leads are dated by KBS lead creation; payout events by the MIS evidence
        that made them eligible.{' '}
        {row.awaitingManagerApproval
          ? `${row.awaitingManagerApproval} request(s) are waiting for a Manager decision.`
          : ''}
      </Callout>

      <div className="grid gap-6 lg:grid-cols-3">
        <Dist title="Current stage" d={row.stage} icon={GitBranch} />
        <Dist title="Final decision" d={row.decision} icon={Scale} />
        <Dist title="Card activation" d={row.activation} icon={CreditCard} />
      </div>

      {row.bankReasons.top.length ? (
        <SectionCard
          icon={MessageSquareWarning}
          tone="amber"
          title="Bank reasons"
          description={`${row.bankReasons.leadsWithReason.value} of ${row.bankReasons.leadsWithReason.denominator?.value ?? 0} MIS-matched leads carry a bank remark or decline field (verbatim).`}
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {row.bankReasons.top.map((r) => (
              <li
                key={r.value}
                className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 break-words text-slate-800">{r.value}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        icon={ListChecks}
        tone="sky"
        title="Recent leads"
        description={`Latest ${leads.data.length} of ${Number(leads.meta.total ?? leads.data.length)} · stage, decision and activation shown separately.`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/manager/leads?advisorId=${id}`}>All leads with filters</Link>
          </Button>
        }
        flush={leads.data.length > 0}
      >
        <AdvisorLeadsTable rows={leads.data} />
      </SectionCard>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <SectionCard
          icon={Wallet}
          tone="teal"
          title="Payout requests"
          description="Newest first. Open a request to see both approvals and the Accounts payment record."
          flush={requests.data.length > 0}
        >
          <AdvisorRequestsTable rows={requests.data} />
        </SectionCard>
        <SectionCard
          icon={BadgeCheck}
          tone="emerald"
          title="Eligible card events"
          description="Payout entitlements created from applied bank MIS under the approved rule. Paid events cannot be claimed again."
          flush={ents.data.length > 0}
        >
          <AdvisorEntitlementsTable rows={ents.data} />
        </SectionCard>
      </div>
    </div>
  );
}
