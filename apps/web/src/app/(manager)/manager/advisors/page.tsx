import { Filter } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { MiniStat, selectClass } from '@/components/ui/kit';
import { type AdvisorTeamResponse } from '@/lib/advisor-team';
import { apiFetch } from '@/lib/api';

import { AdvisorsTable } from './advisors-table';

export const metadata = { title: 'Advisors · KBS Solutions' };

/**
 * F-315 → F-811: the Manager's Advisors with their leads, real MIS results and payout position (REQ-15 §15.1).
 * Evidence per person — no ranking or score (REQ-15 §15.3). Same endpoint as the mobile Advisors tab.
 */
export default async function ManagerAdvisorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'bankId'] as const) if (sp[k]) qs.set(k, sp[k] as string);
  const [data, banks] = await Promise.all([
    apiFetch<AdvisorTeamResponse>(`/dashboards/manager/advisors?${qs.toString()}`).then(
      (r) => r.data,
    ),
    apiFetch<{ banks: { id: string; displayName: string }[] }>('/leads/filters')
      .then((r) => r.data.banks)
      .catch(() => []),
  ]);
  // KPIs are sums of the rows below (every Advisor reporting to you, in the chosen range).
  const sum = (f: (r: AdvisorTeamResponse['rows'][number]) => number) =>
    data.rows.reduce((a, r) => a + f(r), 0);
  const active = data.rows.filter((r) => r.user.status === 'ACTIVE').length;
  const created = sum((r) => r.leads.created.value);
  const matched = sum((r) => r.leads.misMatched.value);
  const awaitingMis = sum((r) => r.leads.awaitingMis.value);
  const awaitingMe = sum((r) => r.awaitingManagerApproval);
  const range = qs.toString() ? 'In the chosen range' : 'All time';
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Advisors</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Reporting to you" value={data.rows.length} hint={`${active} active`} tone="violet" />
        <MiniStat label="Leads created" value={created} hint={range} tone="sky" />
        <MiniStat label="Matched in bank MIS" value={matched} hint={`of ${created} · ${awaitingMis} awaiting`} tone="indigo" />
        <MiniStat label="Awaiting my approval" value={awaitingMe} hint="Payout requests" tone={awaitingMe ? 'amber' : 'slate'} href={awaitingMe ? '/manager/payouts/requests?awaitingMe=true' : undefined} />
      </div>
      <section aria-label="Advisor results" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <Form
          className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3"
          action="/manager/advisors"
        >
          <input aria-label="Leads from" className={`${selectClass} h-9 w-36`} type="date" name="from" defaultValue={sp.from ?? ''} />
          <input aria-label="Leads to" className={`${selectClass} h-9 w-36`} type="date" name="to" defaultValue={sp.to ?? ''} />
          <select aria-label="Bank" id="bankId" className={`${selectClass} h-9 min-w-36`} name="bankId" defaultValue={sp.bankId ?? ''}>
            <option value="">All banks</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-9">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href="/manager/advisors">Reset</Link>
          </Button>
        </Form>
        <div className="min-h-0 flex-1">
          <AdvisorsTable rows={data.rows} qs={qs.toString()} />
        </div>
        <div className="flex shrink-0 items-center border-t border-slate-100 px-4 py-2 text-xs text-slate-500 tabular-nums">
          {data.rows.length} Advisor{data.rows.length === 1 ? '' : 's'}
        </div>
      </section>
    </div>
  );
}
