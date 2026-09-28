import {
  OctagonAlert,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Callout,
  MiniStat,
} from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { LegalHoldForm } from './actions';
import { type CategoryPlan, type Hold, LegalHoldsTable, RetentionPlanTable } from './retention-tables';

export const metadata = { title: 'Retention · KBS Solutions' };

interface Plan {
  executionEnabled: boolean;
  scheduleEnabled: boolean;
  neverRemoved: string[];
  categories: CategoryPlan[];
}

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-IN'));

/** F-904 → F-811 Admin: retention dry run, fail-closed execution and legal holds (REQ-21 §21.5). */
export default async function RetentionPage() {
  const [{ data: plan }, { data: holds }] = await Promise.all([
    apiFetch<Plan>('/retention/plan'),
    apiFetch<{ files: Hold[]; records: Hold[] }>('/retention/legal-holds'),
  ]);
  const allHolds = [...holds.files, ...holds.records];
  const unset = plan.categories.filter((c) => !c.configured);
  const blocked = unset.length > 0 || !plan.executionEnabled;
  const nightly = plan.scheduleEnabled && plan.executionEnabled;
  const configured = plan.categories.length - unset.length;
  const counted = plan.categories.filter((c) => c.eligible !== null);
  const eligible = counted.reduce((sum, c) => sum + (c.eligible ?? 0), 0);
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Data retention &amp; legal hold</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Retention runs" value={blocked ? 'Blocked' : 'Ready'} hint={`execution ${plan.executionEnabled ? 'on' : 'off'} · nightly ${nightly ? 'on' : 'off'}`} tone={blocked ? 'rose' : 'emerald'} />
        <MiniStat label="Durations set" value={`${configured} / ${plan.categories.length}`} hint={unset.length ? 'Awaiting KBS approval' : 'Every category has a duration'} tone={unset.length ? 'amber' : 'emerald'} />
        <MiniStat label="Eligible now" value={counted.length ? n(eligible) : '—'} hint={counted.length ? 'Dry run across configured categories' : 'No durations set'} tone="sky" />
        <MiniStat label="Legal holds" value={n(allHolds.length)} hint="Skipped by every run" tone="violet" />
      </div>
      {blocked ? (
        <Callout tone="warning" icon={OctagonAlert} role="status" title={<span className="inline-flex flex-wrap items-center gap-2"><Badge variant="warning">Blocked</Badge> Retention is not running</span>} className="shrink-0">
          <p>
            KBS has not approved retention durations yet (REQ-21 §21.5 OPEN). Nothing is purged or restricted until each duration is set and <span className="font-mono">retention.executionEnabled</span> is on in <Link className="font-medium underline underline-offset-2" href="/admin/config">Configuration</Link>.
          </p>
          {unset.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span>Missing:</span>
              {unset.map((c) => (
                <code key={c.configKey} className="rounded-md bg-white px-2 py-0.5 font-mono text-xs break-all text-amber-900 ring-1 ring-amber-200">
                  {c.configKey}
                </code>
              ))}
            </div>
          ) : null}
        </Callout>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:overflow-visible">
        <section aria-label="Dry run" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Dry run — counts are live and change nothing · nightly 02:00 IST <Badge variant={nightly ? 'success' : 'unknown'}>{nightly ? 'on' : 'off'}</Badge>
          </div>
          <div className="min-h-0 flex-1">
            <RetentionPlanTable rows={plan.categories} />
          </div>
          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p>Never removed: {plan.neverRemoved.join(' · ')}.</p>
          </div>
        </section>
        <section aria-label="Legal holds" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 p-3">
            <LegalHoldForm />
          </div>
          <div className="min-h-0 flex-1">
            <LegalHoldsTable rows={allHolds} />
          </div>
        </section>
      </div>
    </div>
  );
}
