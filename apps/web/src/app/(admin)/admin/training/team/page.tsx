import { CheckCircle2, Clock, GraduationCap, ListChecks, TriangleAlert, Users } from 'lucide-react';

import { TrainingTeamTable } from '@/components/training-team-table';
import { Badge } from '@/components/ui/badge';
import { Meter, PageHeader, SectionCard, StatCard, StatGrid, type Tone } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { STATUS_LABEL, statusTone, type TrainingTeamRow } from '@/lib/training-types';

const TONE_BY_STATUS: Record<ReturnType<typeof statusTone>, Tone> = { success: 'emerald', destructive: 'rose', unknown: 'slate', info: 'sky' };

/** F-205 (Admin): organisation-wide training progress with aggregates. */
export default async function AdminTrainingTeam() {
  const r = await apiFetch<TrainingTeamRow[]>('/training/team');
  const meta = r.meta as { population?: number; byStatus?: Record<string, number>; passRate?: Array<{ sequence: number; reached: number; passed: number }> };
  const by = meta.byStatus ?? {};
  const inProgress = (by.IN_PROGRESS ?? 0) + (by.REACTIVATED_IN_PROGRESS ?? 0);
  return (
    <div className="grid gap-6">
      <PageHeader icon={ListChecks} eyebrow="People" tone="violet" title="Training progress" description={`${meta.population ?? 0} Telecallers enrolled across all Managers.`}>
        <StatGrid>
          <StatCard label="Enrolled" value={meta.population ?? 0} hint="Telecallers across all Managers" icon={Users} tone="violet" />
          <StatCard label={STATUS_LABEL.PASSED} value={by.PASSED ?? 0} hint="All three modules passed" icon={CheckCircle2} tone="emerald" />
          <StatCard label="In progress" value={inProgress} hint={`Includes ${by.REACTIVATED_IN_PROGRESS ?? 0} reactivated`} icon={Clock} tone="sky" />
          <StatCard label={STATUS_LABEL.EXPIRED_DEACTIVATED} value={by.EXPIRED_DEACTIVATED ?? 0} hint="72-hour window ended before passing" icon={TriangleAlert} tone={by.EXPIRED_DEACTIVATED ? 'rose' : 'slate'} />
        </StatGrid>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <SectionCard icon={Users} tone="violet" title="By status" description="Telecallers in each training state.">
          <ul className="grid gap-3">
            {Object.entries(by).map(([k, v]) => (
              <li key={k} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={statusTone(k)} className="tabular-nums">
                    {STATUS_LABEL[k] ?? k}: {v}
                  </Badge>
                  <span className="text-[11px] text-slate-500 tabular-nums">of {meta.population ?? 0}</span>
                </div>
                <Meter value={v} max={meta.population ?? 0} tone={TONE_BY_STATUS[statusTone(k)]} label={`${STATUS_LABEL[k] ?? k}: ${v}`} />
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard icon={GraduationCap} tone="sky" title="Module pass rate" description="Passed out of Telecallers who reached each module.">
          <ul className="grid gap-3">
            {(meta.passRate ?? []).map((p) => (
              <li key={p.sequence} className="grid gap-1.5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-slate-700">Module {p.sequence}</span>
                  <span className="text-slate-500 tabular-nums">
                    M{p.sequence}: {p.passed}/{p.reached} passed
                  </span>
                </div>
                <Meter value={p.passed} max={p.reached} tone="emerald" label={`Module ${p.sequence}: ${p.passed} of ${p.reached} passed`} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      <SectionCard icon={ListChecks} tone="violet" title="Telecallers" description="Deadline, time remaining and best score per module." flush={r.data.length > 0}>
        <TrainingTeamTable rows={r.data} linkBase="/admin/training/team" />
      </SectionCard>
    </div>
  );
}
