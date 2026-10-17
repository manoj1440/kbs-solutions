import { MiniStat, StatStrip } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { ComplianceActions } from './actions';
import { type Suppression, SuppressionTable } from './suppression-table';

export const metadata = { title: 'Compliance · KBS Solutions' };

/** F-306/F-304 → F-811 Admin: suppression list, DND import, pincode master import. */
export default async function CompliancePage() {
  const s = await apiFetch<Suppression[]>('/suppressions?pageSize=100&includeLifted=true');
  const total = Number(s.meta.total ?? s.data.length);
  const active = s.data.filter((r) => !r.liftedAt).length;
  const lifted = s.data.length - active;
  const scope = total > s.data.length ? `of the latest ${s.data.length}` : 'all entries';
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Compliance &amp; reference data</h1>
      <StatStrip cols={3}>
        <MiniStat label="Suppression entries" value={total} hint="Including lifted" tone="sky" />
        <MiniStat label="Active suppressions" value={active} hint={`${scope} · calls blocked`} tone={active ? 'rose' : 'slate'} />
        <MiniStat label="Lifted" value={lifted} hint={`${scope} · kept for the record`} tone="violet" />
      </StatStrip>
      <ComplianceActions />
      <section aria-label="Suppressed mobiles" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border-subtle px-4 py-2.5 text-xs text-muted-foreground">
          Suppression applies to every import and blocks call initiation server-side — hidden, never deleted (INV-07).
        </div>
        <div className="min-h-0 flex-1">
          <SuppressionTable rows={s.data} />
        </div>
        <div className="flex shrink-0 items-center border-t border-border-subtle px-4 py-2 text-xs text-muted-foreground tabular-nums">
          {total} entr{total === 1 ? 'y' : 'ies'}
        </div>
      </section>
    </div>
  );
}
