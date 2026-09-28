import { formatDateTime, formatInr } from '@kbs/shared';
import { CalendarRange, Filter } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import {
  AdvisorPerformanceTable,
  type AdvisorRow,
  BankCardMixTable,
  type BankCardMixRow,
  ManagerPerformanceTable,
  type ManagerRow,
  TelecallerPerformanceTable,
  type TelecallerRow,
} from '@/components/admin-dashboard-columns';
import { AdminDashboardNav } from '@/components/admin-dashboard-nav';
import { Button } from '@/components/ui/button';
import { MiniStat, selectClass, type Tone } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

interface Meta {
  from: string | null;
  to: string | null;
  asOf: string;
  note: string;
}
const total = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((n, r) => n + f(r), 0);

function qsOf(sp: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'managerId', 'bankId']) if (sp[k]) qs.set(k, sp[k] as string);
  return qs.toString();
}

function Frame({
  path,
  title,
  sp,
  meta,
  stats,
  children,
}: {
  path: string;
  title: string;
  sp: Record<string, string | undefined>;
  meta: Meta;
  stats?: { label: string; value: number; hint: string; tone?: Tone }[];
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
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <AdminDashboardNav active={path} />
          <span className="text-xs text-slate-500 tabular-nums">
            <CalendarRange className="mr-1 inline size-3.5 -translate-y-px" aria-hidden="true" />
            {meta.from || meta.to ? `${meta.from ?? '…'} → ${meta.to ?? '…'}` : 'All time'} · as of {formatDateTime(meta.asOf)}
          </span>
        </div>
        <Form className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 p-3" action={path}>
          <input aria-label="From date" className={`${selectClass} h-9 w-36`} type="date" name="from" defaultValue={sp.from ?? ''} />
          <input aria-label="To date" className={`${selectClass} h-9 w-36`} type="date" name="to" defaultValue={sp.to ?? ''} />
          <Button type="submit" size="sm" className="h-9">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={path}>Reset</Link>
          </Button>
        </Form>
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </div>
  );
}

export async function TelecallerPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: TelecallerRow[]; meta: Meta }>(`/dashboards/admin/telecallers?${qsOf(sp)}`)).data;
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
    >
      <TelecallerPerformanceTable rows={d.rows} />
    </Frame>
  );
}

export async function ManagerPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: ManagerRow[]; meta: Meta }>(`/dashboards/admin/managers?${qsOf(sp)}`)).data;
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
    >
      <ManagerPerformanceTable rows={d.rows} />
    </Frame>
  );
}

export async function AdvisorPerformance({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: AdvisorRow[]; meta: Meta }>(`/dashboards/admin/advisors?${qsOf(sp)}`)).data;
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
    >
      <AdvisorPerformanceTable rows={d.rows} />
    </Frame>
  );
}

export async function BankCardMix({ sp }: { sp: Record<string, string | undefined> }) {
  const d = (await apiFetch<{ rows: BankCardMixRow[]; meta: Meta & { source: string } }>(`/dashboards/admin/bank-card-mix?${qsOf(sp)}`)).data;
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
    >
      <BankCardMixTable rows={d.rows} />
    </Frame>
  );
}
