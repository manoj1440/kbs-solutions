import { Users } from 'lucide-react';

import { type OverviewRow, RangeForm, rangeParams, TeamActivityTable } from '@/components/team-ops';
import { EmptyState, MiniStat } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Caller performance · KBS Solutions' };

interface DistributionRow {
  id: string;
  eligible: boolean;
  needsReassignment: boolean;
}

/**
 * F-808 (F-313 + F-305): what each caller did in the range and what they hold now, on one screen; the table scrolls
 * inside the page. Evidence counts only — no scores or ranks; "connected" is provider-confirmed.
 */
export default async function CallerPerformancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [ov, dist] = await Promise.all([
    apiFetch<{ range: { from: string; to: string }; telecallers: OverviewRow[] }>(`/calling/team/overview?${rangeParams(sp)}`).then((r) => r.data),
    apiFetch<{ telecallers: DistributionRow[]; unassigned: number | null }>('/calling/distribution').then((r) => r.data),
  ]);
  const rows = ov.telecallers;
  const sum = (f: (t: OverviewRow) => number) => rows.reduce((n, t) => n + f(t), 0);
  const attempts = sum((t) => t.attempts);
  const connected = sum((t) => t.connected);
  const shares = sum((t) => Object.values(t.shares).reduce((a, b) => a + b, 0));
  const outcomes = sum((t) => Object.values(t.outcomes).reduce((a, b) => a + b, 0));
  const reassign = dist.telecallers.filter((t) => t.needsReassignment).length;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Caller performance</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <MiniStat label="Callers" value={rows.length} hint={`${rows.filter((t) => t.status === 'ACTIVE').length} active · ${dist.telecallers.filter((t) => t.eligible).length} can take records`} tone="violet" />
        <MiniStat label="Records held" value={sum((t) => t.queueSize)} hint={`${dist.unassigned ?? 0} waiting for a caller`} tone="sky" />
        <MiniStat label="Follow-ups due now" value={sum((t) => t.followUpsDue)} hint="Across all callers" tone="amber" />
        <MiniStat label="Call attempts" value={attempts} hint="In the period" tone="indigo" />
        <MiniStat label="Connected" value={connected} hint={`${attempts ? Math.round((connected / attempts) * 100) : 0}% · ${Math.round(sum((t) => t.talkTimeSec) / 60)} min talk`} tone="emerald" />
        <MiniStat label="Outcomes recorded" value={outcomes} hint={`${sum((t) => t.interests)} interests`} tone="teal" />
        <MiniStat label="Materials shared" value={shares} hint="Links, PDFs, IDs" tone="teal" />
        <MiniStat label="Need reassignment" value={reassign} hint="Inactive callers holding records" tone={reassign ? 'rose' : 'slate'} />
      </div>
      <section aria-label="Caller activity" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-100 p-3">
          <RangeForm base="/admin/calling-list/performance" sp={sp} />
        </div>
        <div className="min-h-0 flex-1">
          {rows.length ? (
            <TeamActivityTable rows={rows} base="/admin/calling-list/performance" sp={sp} containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto" headerClassName="sticky top-0 z-10" />
          ) : (
            <EmptyState icon={Users} title="No callers yet." className="m-3" />
          )}
        </div>
      </section>
    </div>
  );
}
