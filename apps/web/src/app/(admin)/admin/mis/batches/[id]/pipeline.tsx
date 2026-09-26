'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { Check, CheckCheck, CircleAlert, CircleCheck, Loader2, ScanSearch, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type * as React from 'react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout, humanize, Meter, SectionCard, TONE, type Tone } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

interface PreviewReport {
  generatedAt: string;
  totals: Record<string, number>;
  referenceCoverage: number;
  blankStatusCounts: Record<string, number>;
  newValues: Record<string, string[]>;
  duplicateReferences: { reference: string; rows: number }[];
  samples: Record<string, { row: number; customer: string; references: { kind: string; value: string }[]; explanation: string | null }[]>;
}

export interface MisJob {
  kind: 'PREVIEW' | 'APPLY' | null;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | null;
  progress: { phase: string; done: number; total: number } | null;
  error: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}
const PHASE: Record<string, string> = { queued: 'Waiting for a worker', match: 'Matching rows to leads', apply: 'Applying bank status', payouts: 'Evaluating payout rules' };
const active = (j: MisJob | null) => j?.status === 'QUEUED' || j?.status === 'RUNNING';

/** F-508: progress for a background preview/apply; polls until the job ends, then refreshes the page. */
function JobProgress({ batchId, job, onDone }: { batchId: string; job: MisJob; onDone: (j: MisJob) => void }) {
  const [j, setJ] = useState(job);
  useEffect(() => {
    if (!active(j)) return;
    const t = setTimeout(async () => {
      try {
        const next = (await clientApi.get<{ job: MisJob }>(`/mis/batches/${batchId}/job`)).data.job;
        setJ(next);
        if (!active(next)) onDone(next);
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [j, batchId, onDone]);
  const p = j.progress;
  const pct = p && p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
  const what = j.kind === 'APPLY' ? 'Apply' : 'Preview';
  if (j.status === 'FAILED')
    return (
      <Callout tone="danger" icon={CircleAlert} role="alert">
        {what} stopped: {j.error}. Rows already applied are kept — run it again to continue.
      </Callout>
    );
  if (!active(j)) return null;
  return (
    <div className="grid gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-sky-950">
        <span className="inline-flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin text-sky-600" aria-hidden="true" />
          {what} running in the background · {PHASE[p?.phase ?? 'queued'] ?? p?.phase}
        </span>
        <span className="text-[13px] tabular-nums">{p ? `${p.done.toLocaleString('en-IN')} / ${p.total.toLocaleString('en-IN')}` : ''}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-sky-100">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-sky-900/80">You can leave this page; you will get a notification when it finishes.</span>
    </div>
  );
}

const TOTAL_TONE = (k: string): Tone => (k === 'MATCHED' ? 'emerald' : k === 'CONFLICT' || k === 'INVALID' ? 'rose' : k === 'UNMATCHED' ? 'amber' : k === 'rows' ? 'sky' : 'slate');

function Tile({ label, value, tone, children }: { label: string; value: React.ReactNode; tone: Tone; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600">
        <span className={cn('size-2 rounded-full', TONE[tone].bar)} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {children}
    </div>
  );
}

/** F-503 preview tiles + F-505 apply. */
export function PipelineActions({ batchId, stage, report, totals, profileId, job: initialJob }: { batchId: string; stage: string; report: PreviewReport | null; totals: Record<string, number> | null; profileId: string | null; job?: MisJob | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [job, setJob] = useState<MisJob | null>(initialJob ?? null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = (await fn()) as { data?: { queued?: boolean; job?: MisJob } } | undefined;
      if (r?.data?.queued && r.data.job) {
        setJob(r.data.job);
        return;
      }
      setMsg(ok);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };
  const running = active(job);
  const canPreview = !running && (stage === 'MAPPED' || stage === 'PREVIEWED');
  const canApply = !running && (stage === 'PREVIEWED' || stage === 'FAILED');
  const previewPrimary = stage !== 'PREVIEWED' && stage !== 'FAILED';
  return (
    <SectionCard
      icon={ScanSearch}
      tone="teal"
      title="Preview & apply"
      description="Preview matches rows to leads by exact bank reference (dry run). Apply is the only operation that writes bank status; it is idempotent."
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={previewPrimary ? 'default' : 'outline'} disabled={!canPreview || busy} onClick={() => void run(() => clientApi.post(`/mis/batches/${batchId}/preview`, {}), 'Preview generated.')}>
            <ScanSearch />
            {stage === 'PREVIEWED' ? 'Re-run preview' : 'Run preview'}
          </Button>
          <Button variant={previewPrimary ? 'outline' : 'default'} disabled={!canApply || busy} onClick={() => void run(() => clientApi.post(`/mis/batches/${batchId}/apply`, {}), 'Batch applied.')}>
            <CheckCheck />
            Confirm processing (apply)
          </Button>
        </div>
        {job && (running || job.status === 'FAILED') ? (
          <JobProgress
            key={`${job.kind}-${job.queuedAt}`}
            batchId={batchId}
            job={job}
            onDone={(j) => {
              setJob(j);
              setMsg(j.status === 'SUCCEEDED' ? (j.kind === 'APPLY' ? 'Batch applied.' : 'Preview generated.') : null);
              router.refresh();
            }}
          />
        ) : null}
        {msg ? (
          <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {msg}
          </p>
        ) : null}
        {stage === 'APPLIED' && totals ? (
          <Callout tone="success" icon={CircleCheck}>
            Applied: {totals.updatedChanged ?? 0} lead(s) changed · {totals.updatedNoChange ?? 0} confirmed unchanged · {totals.needsReview ?? 0} need review · {totals.ignored ?? 0} ignored · {totals.invalid ?? 0} invalid.
          </Callout>
        ) : null}
        {report ? (
          <div className="grid gap-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Preview report</p>
              <p className="text-xs text-slate-500">Generated {formatDateTime(report.generatedAt)}. Customer names are masked in this report.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(report.totals).map(([k, v]) => (
                <Tile key={k} label={humanize(k)} value={v} tone={TOTAL_TONE(k)} />
              ))}
              <Tile label="Reference coverage" value={`${report.referenceCoverage}%`} tone="teal">
                <Meter value={report.referenceCoverage} max={100} tone="teal" className="mt-2 h-1.5" label="Reference coverage" />
              </Tile>
            </div>
            {Object.keys(report.newValues).length ? (
              <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950">
                    <Sparkles className="size-4 text-amber-600" aria-hidden="true" />
                    New values pending mapping (stored verbatim)
                  </p>
                  {profileId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void run(() => clientApi.post(`/mis/profiles/${profileId}/known-values`, { values: report.newValues, reason: `acknowledged from batch ${batchId}` }), 'Values acknowledged on the profile.')}
                    >
                      <Check />
                      Acknowledge as known values
                    </Button>
                  ) : null}
                </div>
                {Object.entries(report.newValues).map(([f, vals]) => (
                  <div key={f} className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-mono font-semibold text-slate-700">{f}</span>
                    {vals.map((v) => (
                      <span key={v} className="rounded-md bg-white px-1.5 py-0.5 text-slate-800 ring-1 ring-amber-200">
                        {v}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
            {Object.keys(report.blankStatusCounts).length ? (
              <div className="grid gap-1.5">
                <p className="text-xs font-semibold text-slate-700">Blank / not reported:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(report.blankStatusCounts).map(([f, n]) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                      <span className="font-mono">{f}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {report.duplicateReferences.length ? (
              <div className="grid gap-1.5">
                <p className="text-xs font-semibold text-slate-700">Duplicate references:</p>
                <div className="flex flex-wrap gap-1.5">
                  {report.duplicateReferences.map((d) => (
                    <span key={d.reference} className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
                      {d.reference} ×{d.rows}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {(['conflicts', 'unmatched'] as const).map((k) =>
              report.samples[k]?.length ? (
                <div key={k} className="grid gap-1.5">
                  <p className="text-xs font-semibold text-slate-700 capitalize">{k} (sample)</p>
                  <ul className="grid gap-1.5">
                    {report.samples[k].map((s) => (
                      <li key={s.row} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-slate-200">
                        <span className="font-semibold text-slate-900 tabular-nums">row {s.row}</span>
                        <span className="text-slate-600">{s.customer}</span>
                        <span className="font-mono break-all text-slate-700">{s.references.map((r) => `${r.kind}=${r.value}`).join(', ')}</span>
                        <span className="text-slate-500">{s.explanation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
