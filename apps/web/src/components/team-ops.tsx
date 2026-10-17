import { type CallingQueueRow, formatDateTime } from '@kbs/shared';
import { ArrowLeft, Filter, Users } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, MiniStat, SectionCard, selectClass, StatStrip } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { fmtTalk, type OverviewRow, rangeParams } from '@/lib/calling-shared';
import { cn } from '@/lib/utils';

import { AssignedRecordsTable, TeamActivityTable } from '@/components/team-ops-tables';

export { type OverviewRow, rangeParams, RECORD_STATUS_VARIANT } from '@/lib/calling-shared';
export { TeamActivityTable } from '@/components/team-ops-tables';

/** F-313 §1: team overview — evidence counts with denominators, no ranking. */
export async function TeamOverview({
  base,
  sp,
}: {
  base: string;
  sp: { from?: string; to?: string };
}) {
  const ov = await apiFetch<{ range: { from: string; to: string }; telecallers: OverviewRow[] }>(
    `/calling/team/overview?${rangeParams(sp)}`,
  );
  const rows = ov.data.telecallers;
  return (
    <SectionCard
      icon={Users}
      tone="violet"
      title="Team activity"
      description={`${formatDateTime(ov.data.range.from)} → ${formatDateTime(ov.data.range.to)} · attempts = call rows; connected = provider-confirmed only.`}
      actions={<RangeForm base={base} sp={sp} />}
      flush={rows.length > 0}
    >
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No Telecallers." />
      ) : (
        <TeamActivityTable rows={rows} base={base} sp={sp} />
      )}
    </SectionCard>
  );
}

export function RangeForm({ base, sp }: { base: string; sp: { from?: string; to?: string } }) {
  const date = cn(selectClass, 'h-9 w-auto px-2');
  return (
    <Form action={base} className="flex flex-wrap items-center gap-2 text-xs">
      <label className="flex items-center gap-1.5 font-medium text-fg-2">
        From
        <input type="date" name="from" defaultValue={sp.from?.slice(0, 10)} className={date} />
      </label>
      <label className="flex items-center gap-1.5 font-medium text-fg-2">
        To
        <input type="date" name="to" defaultValue={sp.to?.slice(0, 10)} className={date} />
      </label>
      <Button type="submit" variant="outline" size="sm" className="h-9">
        <Filter />
        Apply
      </Button>
    </Form>
  );
}

/** F-808: Telecaller drill-down — one screen: caller identity, period tiles, assigned records with last-call info. */
export async function TelecallerActivity({
  id,
  base,
  sp,
}: {
  id: string;
  base: string;
  sp: { from?: string; to?: string };
}) {
  const [ov, recs] = await Promise.all([
    apiFetch<{ telecallers: OverviewRow[] }>(`/calling/team/overview?${rangeParams(sp)}`),
    apiFetch<CallingQueueRow[]>(`/calling/records?telecallerId=${id}&status=ALL&pageSize=100`),
  ]);
  const t = ov.data.telecallers.find((x) => x.id === id);
  if (!t) return <EmptyState icon={Users} title="Caller not found in your scope." className="mt-8" />;
  const records = recs.data;
  const total = Number(recs.meta.total ?? records.length);
  const pct = t.attempts ? Math.round((t.connected / t.attempts) * 100) : 0;
  const rate = t.connected ? Math.round((t.interests / t.connected) * 100) : 0;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={t.fullName} size="lg" />
          <div className="min-w-0">
            <Link href={base} className="mb-0.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All callers
            </Link>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{t.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={t.status === 'ACTIVE' ? 'success' : 'unknown'}>{humanize(t.status)}</Badge>
              {t.employeeCode ? <span className="font-mono">{t.employeeCode}</span> : null}
              {t.training === 'PASSED' ? null : <Badge variant="warning">not trained</Badge>}
            </div>
          </div>
        </div>
        <RangeForm base={`${base}/telecaller/${id}`} sp={sp} />
      </div>
      <StatStrip cols={6}>
        <MiniStat label="Assigned" value={t.queueSize} hint={`${t.followUpsDue} follow-ups due`} tone="violet" />
        <MiniStat label="Attempted" value={t.attempts} hint="Calls in the period" tone="sky" />
        <MiniStat label="Connected" value={t.connected} hint={`${pct}% of attempts`} tone="emerald" />
        <MiniStat label="Succeeded" value={t.interests} hint="Marked interested" tone="teal" />
        <MiniStat label="Talk time" value={fmtTalk(t.talkTimeSec)} hint="Connected calls" tone="indigo" />
        <MiniStat label="Success rate" value={`${rate}%`} hint="Of connected calls" tone="amber" />
      </StatStrip>
      <section aria-label="Assigned records" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-fg-2">Assigned records</span>
          <span className="tabular-nums">{total}</span>
        </div>
        <div className="min-h-0 flex-1">
          <AssignedRecordsTable rows={records} />
        </div>
      </section>
    </div>
  );
}
