import { GraduationCap, Users } from 'lucide-react';

import { TrainingTeamTable } from '@/components/training-team-table';
import { Badge } from '@/components/ui/badge';
import { Meter, MiniStat, type Tone } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { STATUS_LABEL, statusTone, type TrainingTeamRow } from '@/lib/training-types';

const TONE_BY_STATUS: Record<ReturnType<typeof statusTone>, Tone> = { success: 'emerald', destructive: 'rose', unknown: 'slate', info: 'sky' };

export const metadata = { title: 'Training progress · KBS Solutions' };

/** F-205 → F-811 (Admin): org-wide training progress — tiles, compact breakdowns, internal-scroll team table. */
export default async function AdminTrainingTeam() {
  const r = await apiFetch<TrainingTeamRow[]>('/training/team');
  const meta = r.meta as { population?: number; byStatus?: Record<string, number>; passRate?: Array<{ sequence: number; reached: number; passed: number }> };
  const by = meta.byStatus ?? {};
  const inProgress = (by.IN_PROGRESS ?? 0) + (by.REACTIVATED_IN_PROGRESS ?? 0);
  const population = meta.population ?? 0;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Training progress</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Enrolled" value={population} hint="Telecallers across all Managers" tone="sky" />
        <MiniStat label={STATUS_LABEL.PASSED} value={by.PASSED ?? 0} hint="All three modules passed" tone="emerald" />
        <MiniStat label="In progress" value={inProgress} hint={`${by.REACTIVATED_IN_PROGRESS ?? 0} reactivated`} tone="violet" />
        <MiniStat label={STATUS_LABEL.EXPIRED_DEACTIVATED} value={by.EXPIRED_DEACTIVATED ?? 0} hint="72-hour window ended" tone={by.EXPIRED_DEACTIVATED ? 'rose' : 'slate'} />
      </div>

      <div className="grid shrink-0 gap-3 lg:grid-cols-2">
        <section aria-label="By status" className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <ul className="grid gap-1.5">
            {Object.entries(by).map(([k, v]) => (
              <li key={k} className="flex items-center gap-3">
                <Badge variant={statusTone(k)} className="w-44 shrink-0 justify-start tabular-nums">
                  {STATUS_LABEL[k] ?? k}: {v}
                </Badge>
                <Meter value={v} max={population} tone={TONE_BY_STATUS[statusTone(k)]} label={`${STATUS_LABEL[k] ?? k}: ${v}`} className="flex-1" />
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Module pass rate" className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <ul className="grid gap-1.5">
            {(meta.passRate ?? []).map((p) => (
              <li key={p.sequence} className="flex items-center gap-3">
                <span className="flex w-44 shrink-0 items-center gap-2 text-xs font-medium text-slate-700">
                  <GraduationCap className="size-3.5 text-slate-400" aria-hidden="true" />
                  M{p.sequence}: {p.passed}/{p.reached} passed
                </span>
                <Meter value={p.passed} max={p.reached} tone="emerald" label={`Module ${p.sequence}: ${p.passed} of ${p.reached} passed`} className="flex-1" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-label="Telecallers" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <Users className="size-3.5" aria-hidden="true" />
          {r.data.length} telecaller{r.data.length === 1 ? '' : 's'} · deadline, remaining time and best score per module
        </div>
        <div className="min-h-0 flex-1">
          <TrainingTeamTable rows={r.data} linkBase="/admin/training/team" />
        </div>
      </section>
    </div>
  );
}
