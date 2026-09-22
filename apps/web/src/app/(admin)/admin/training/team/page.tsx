import { TrainingTeamTable } from '@/components/training-team-table';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { STATUS_LABEL, type TrainingTeamRow } from '@/lib/training-types';

/** F-205 (Admin): organisation-wide training progress with aggregates. */
export default async function AdminTrainingTeam() {
  const r = await apiFetch<TrainingTeamRow[]>('/training/team');
  const meta = r.meta as { population?: number; byStatus?: Record<string, number>; passRate?: Array<{ sequence: number; reached: number; passed: number }> };
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Training progress</h1>
        <p className="text-muted-foreground text-sm">{meta.population ?? 0} Telecallers enrolled across all Managers.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(meta.byStatus ?? {}).map(([k, v]) => (
          <Badge key={k} variant="secondary">
            {STATUS_LABEL[k] ?? k}: {v}
          </Badge>
        ))}
        {(meta.passRate ?? []).map((p) => (
          <Badge key={p.sequence} variant="outline">
            M{p.sequence}: {p.passed}/{p.reached} passed
          </Badge>
        ))}
      </div>
      <TrainingTeamTable rows={r.data} linkBase="/admin/training/team" />
    </div>
  );
}
