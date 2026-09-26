import { formatDateTime } from '@kbs/shared';
import { Check, Clock, GraduationCap, History, Home, Lock, PlayCircle, RotateCcw, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Avatar, Callout, humanize, KeyValueGrid, Meter, PageHeader, SectionCard } from '@/components/ui/kit';
import { WfhPanel } from '@/components/network-policy';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { WfhRow } from '@/lib/wfh';
import { STATUS_LABEL, statusTone, type TrainingDetail } from '@/lib/training-types';

import { ReactivateButton } from './reactivate-button';

/** F-204/F-205: Telecaller training detail with Manager reactivation. */
export default async function TelecallerTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [d, wfh] = await Promise.all([
    apiFetch<TrainingDetail>(`/telecallers/${id}/training`).then((r) => r.data),
    apiFetch<WfhRow[]>('/access-policy/wfh').then((r) => r.data),
  ]);
  const passedCount = d.modules.filter((m) => m.status === 'PASSED').length;
  const expired = d.status === 'EXPIRED_DEACTIVATED';
  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgb(139_92_246/10%),transparent_65%)]"
        />
        <div className="relative grid gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={d.telecaller.fullName} size="lg" className="shadow-sm ring-4 ring-white" />
            <PageHeader
              eyebrow="Team · Telecaller training"
              tone="violet"
              title={d.telecaller.fullName}
              meta={
                <>
                  <span className="font-mono text-slate-600">{d.telecaller.employeeCode}</span>
                  <Badge variant={statusTone(d.status)}>{STATUS_LABEL[d.status] ?? d.status}</Badge>
                </>
              }
            />
          </div>
          <div className="grid gap-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center">
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Modules passed</span>
                <span className="text-lg font-semibold text-slate-900 tabular-nums">
                  {passedCount}/{d.modules.length}
                </span>
              </div>
              <Meter
                value={passedCount}
                max={d.modules.length}
                tone={d.modules.length && passedCount === d.modules.length ? 'emerald' : expired ? 'rose' : 'sky'}
                label={`${passedCount} of ${d.modules.length} modules passed`}
              />
            </div>
            <KeyValueGrid
              cols={3}
              className="grid-cols-2"
              items={[
                ['First login', d.firstLoginAt ? formatDateTime(d.firstLoginAt) : 'not yet'],
                ['Deadline', d.deadlineAt ? formatDateTime(d.deadlineAt) : '—'],
                ['Reactivations', <span key="r" className="tabular-nums">{d.reactivations.length}</span>],
              ]}
            />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="grid content-start gap-6">
          <SectionCard
            icon={Clock}
            tone={d.canReactivate || expired ? 'amber' : 'sky'}
            title="Training window"
            description={
              <>
                {d.firstLoginAt ? `First login ${formatDateTime(d.firstLoginAt)}` : 'Not logged in yet — the 72-hour window starts at the first login.'}
                {d.deadlineAt ? ` · deadline ${formatDateTime(d.deadlineAt)}` : ''}
              </>
            }
            className={d.canReactivate ? 'ring-2 ring-amber-200' : undefined}
          >
            {expired || (d.status === 'REACTIVATED_IN_PROGRESS' && !d.deadlineAt) || d.canReactivate ? (
              <div className="grid gap-3">
                {expired ? (
                  <Callout tone="danger" icon={TriangleAlert}>
                    The window ended without all modules passed; the account is deactivated. Reactivating resumes at Module {d.modules.find((m) => m.status !== 'PASSED')?.sequence ?? 3} and keeps earlier passes.
                  </Callout>
                ) : null}
                {d.status === 'REACTIVATED_IN_PROGRESS' && !d.deadlineAt ? (
                  <Callout tone="warning" icon={TriangleAlert}>
                    Reactivated, but `training.reactivationWindowHours` is not configured — the Telecaller stays gated until the Admin sets it.
                  </Callout>
                ) : null}
                {d.canReactivate ? <ReactivateButton telecallerId={d.telecaller.id} windowHours={d.reactivationWindowHours} /> : null}
              </div>
            ) : null}
          </SectionCard>

          {d.reactivations.length ? (
            <SectionCard icon={History} tone="emerald" title="Reactivations">
              <ol className="grid gap-3">
                {d.reactivations.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 ring-inset">
                      <RotateCcw className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-slate-800">
                        <span className="tabular-nums">{formatDateTime(r.at)}</span> by {r.byManager.fullName} — resumed at Module {r.resumedAtModuleSequence}
                      </div>
                      <div className="mt-0.5 text-xs break-words text-slate-500">
                        Original deadline {r.originalDeadlineAt ? formatDateTime(r.originalDeadlineAt) : '—'} · new deadline {r.newDeadlineAt ? formatDateTime(r.newDeadlineAt) : 'not configured'} · reason: {r.reason}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>
          ) : null}
        </div>
        <SectionCard
          icon={Home}
          tone="sky"
          title="Work from home"
          description="Outside an office network this Telecaller can call only with an active exception (REQ-09 §9.1). Grants and revocations are audited and notify the Telecaller."
        >
          <WfhPanel telecallerId={d.telecaller.id} rows={wfh} />
        </SectionCard>
      </div>

      <SectionCard icon={GraduationCap} tone="violet" title="Modules" description="Best score against the pass mark, attempts, video and pass date.">
        <ol className="grid gap-4 md:grid-cols-3">
          {d.modules.map((m) => {
            const done = m.status === 'PASSED';
            const locked = m.status === 'LOCKED';
            return (
              <li key={m.sequence} className={cn('grid min-w-0 content-start gap-3 rounded-xl border p-4', done ? 'border-emerald-100 bg-emerald-50/40' : locked ? 'border-slate-200/80 bg-slate-50/60' : 'border-sky-100 bg-white')}>
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset',
                      done ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : locked ? 'bg-slate-100 text-slate-400 ring-slate-200' : 'bg-sky-50 text-sky-700 ring-sky-200',
                    )}
                  >
                    {done ? <Check className="size-4" /> : locked ? <Lock className="size-4" /> : m.sequence}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <span className="text-sm font-semibold break-words text-slate-900">
                      {m.sequence}. {m.title}
                    </span>
                    <Badge variant={done ? 'success' : locked ? 'unknown' : 'info'}>{humanize(m.status)}</Badge>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      Best score{' '}
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {m.bestScorePct ?? '—'}
                        {m.bestScorePct !== null ? '%' : ''}
                      </span>
                    </span>
                    <span className="tabular-nums">pass mark {m.passThresholdPct}%</span>
                  </div>
                  <div className="relative">
                    <Meter
                      value={m.bestScorePct ?? 0}
                      max={100}
                      tone={done ? 'emerald' : m.bestScorePct !== null ? 'amber' : 'slate'}
                      label={`${m.title}: best score ${m.bestScorePct ?? 'none'}, pass mark ${m.passThresholdPct}%`}
                    />
                    <span aria-hidden="true" className="absolute -top-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-slate-500" style={{ left: `${m.passThresholdPct}%` }} />
                  </div>
                </div>
                <dl className="grid gap-1.5 border-t border-slate-200/70 pt-3 text-xs">
                  <div className="flex min-w-0 items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">Attempts</dt>
                    <dd className="text-right text-slate-800 tabular-nums">
                      {m.attemptCount}
                      {m.attempts.length ? <span className="text-slate-500"> ({m.attempts.map((a) => (a.scorePct === null ? 'open' : `${a.scorePct}%`)).join(', ')})</span> : null}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">Video</dt>
                    <dd className="inline-flex items-center gap-1 text-slate-800">
                      {m.videoCompletedAt ? (
                        <>
                          <PlayCircle className="size-3.5 text-emerald-600" aria-hidden="true" />
                          completed
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">Passed at</dt>
                    <dd className="text-right text-slate-800 tabular-nums">{m.passedAt ? formatDateTime(m.passedAt) : '—'}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ol>
      </SectionCard>
    </div>
  );
}
