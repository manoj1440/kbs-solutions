import type { TrainingModuleView } from '@kbs/shared';
import { ArrowUpRight, CheckCircle2, CircleDashed, FilePen, GraduationCap, ListChecks, ListTodo, Video } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Meter, PageHeader, StatCard, StatGrid, StatusDot } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type ModuleRow = TrainingModuleView & { draftQuestionCount?: number };

/** F-202: three modules, each video + MCQ (REQ-05 §5.2). */
export default async function TrainingAdmin() {
  const mods = await apiFetch<ModuleRow[]>('/training/modules');
  const published = mods.data.filter((m) => m.status === 'PUBLISHED').length;
  const videos = mods.data.filter((m) => m.videoFileId).length;
  const liveQuestions = mods.data.reduce((n, m) => n + m.questionCount, 0);
  const drafts = mods.data.filter((m) => m.draftVersion).length;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={GraduationCap}
        eyebrow="Sales operations"
        tone="sky"
        title="Training modules"
        description="Telecallers must pass all three (video + questions) within their 72-hour window. Edits are drafts until you publish."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/training/team">
              <ListChecks />
              Training progress
            </Link>
          </Button>
        }
      >
        <StatGrid>
          <StatCard label="Published modules" value={`${published} / ${mods.data.length}`} hint="Live for Telecallers" icon={CheckCircle2} tone="emerald" />
          <StatCard label="Live questions" value={liveQuestions} hint="Across all modules" icon={ListTodo} tone="sky" />
          <StatCard label="Videos uploaded" value={`${videos} / ${mods.data.length}`} hint="One video per module" icon={Video} tone="violet" />
          <StatCard label="Drafts awaiting publish" value={drafts} hint="Modules with an unpublished draft" icon={FilePen} tone={drafts ? 'amber' : 'slate'} />
        </StatGrid>
      </PageHeader>
      {mods.data.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No training modules" />
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {mods.data.map((m) => {
            const live = m.status === 'PUBLISHED';
            const checks = [
              { label: m.videoFileId ? 'Video uploaded' : 'No video yet', ok: Boolean(m.videoFileId) },
              { label: m.questionCount > 0 ? 'Questions live' : 'No live questions', ok: m.questionCount > 0 },
              { label: live ? 'Published' : 'Not published', ok: live },
            ];
            const done = checks.filter((c) => c.ok).length;
            return (
              <Link
                key={m.id}
                href={`/admin/training/${m.sequence}`}
                prefetch={false}
                className="lift group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <div className={cn('relative flex items-start justify-between gap-3 px-5 pt-5 pb-4', live ? 'bg-gradient-to-br from-sky-50 to-white' : 'bg-gradient-to-br from-amber-50/70 to-white')}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex size-14 items-center justify-center rounded-2xl text-2xl font-bold tracking-tight text-white tabular-nums shadow-sm',
                        live ? 'bg-gradient-to-br from-sky-600 to-teal-600' : 'bg-gradient-to-br from-amber-500 to-orange-500',
                      )}
                    >
                      {String(m.sequence).padStart(2, '0')}
                    </span>
                    <div>
                      <p className="text-[10.5px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Module {m.sequence}</p>
                      <Badge variant={live ? 'success' : 'warning'} className="mt-1">
                        {live ? `v${m.version}` : 'Draft'}
                      </Badge>
                    </div>
                  </div>
                  <ArrowUpRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-700" aria-hidden="true" />
                </div>
                <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
                  <p className="text-[15px] leading-snug font-semibold text-slate-900 group-hover:text-teal-800">{m.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Questions</p>
                      <p className="text-lg font-semibold text-slate-900 tabular-nums">{m.questionCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Pass mark</p>
                      <p className="text-lg font-semibold text-slate-900 tabular-nums">{m.passThresholdPct}%</p>
                    </div>
                  </div>
                  <div className="text-[12.5px] text-slate-600">
                    {m.questionCount} live questions{m.draftVersion ? ` · ${m.draftQuestionCount ?? 0} in draft v${m.draftVersion}` : ''}
                  </div>
                  <ul className="grid gap-1.5">
                    {checks.map((c) => (
                      <li key={c.label} className="flex items-center gap-2 text-[12.5px]">
                        {c.ok ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : <CircleDashed className="size-4 text-slate-400" aria-hidden="true" />}
                        <span className={c.ok ? 'text-slate-700' : 'text-slate-500'}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto grid gap-1.5 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                      <StatusDot tone={done === 3 ? 'emerald' : 'amber'}>{done === 3 ? 'Ready' : 'Setup incomplete'}</StatusDot>
                      <span className="tabular-nums">{done} of 3</span>
                    </div>
                    <Meter value={done} max={3} tone={done === 3 ? 'emerald' : 'amber'} label={`Module ${m.sequence} setup: ${done} of 3`} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
