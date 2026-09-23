'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clientApi } from '@/lib/client-api';

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
      <p role="alert" className="text-destructive rounded-md border p-3 text-sm">
        {what} stopped: {j.error}. Rows already applied are kept — run it again to continue.
      </p>
    );
  if (!active(j)) return null;
  return (
    <div className="grid gap-1 rounded-md border p-3" role="status" aria-live="polite">
      <div className="flex justify-between text-sm">
        <span>
          {what} running in the background · {PHASE[p?.phase ?? 'queued'] ?? p?.phase}
        </span>
        <span className="tabular-nums">{p ? `${p.done.toLocaleString('en-IN')} / ${p.total.toLocaleString('en-IN')}` : ''}</span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-xs">You can leave this page; you will get a notification when it finishes.</span>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview & apply</CardTitle>
        <CardDescription>Preview matches rows to leads by exact bank reference (dry run). Apply is the only operation that writes bank status; it is idempotent.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canPreview || busy} onClick={() => void run(() => clientApi.post(`/mis/batches/${batchId}/preview`, {}), 'Preview generated.')}>
            {stage === 'PREVIEWED' ? 'Re-run preview' : 'Run preview'}
          </Button>
          <Button variant="outline" disabled={!canApply || busy} onClick={() => void run(() => clientApi.post(`/mis/batches/${batchId}/apply`, {}), 'Batch applied.')}>
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
          <p role="status" className="text-sm">
            {msg}
          </p>
        ) : null}
        {report ? (
          <div className="grid gap-2 text-sm">
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.totals).map(([k, v]) => (
                <Badge key={k} variant={k === 'MATCHED' ? 'success' : k === 'CONFLICT' || k === 'INVALID' ? 'destructive' : k === 'UNMATCHED' ? 'warning' : 'secondary'}>
                  {k.toLowerCase()} {v}
                </Badge>
              ))}
              <Badge variant="info">reference coverage {report.referenceCoverage}%</Badge>
            </div>
            <p className="text-muted-foreground text-xs">Generated {formatDateTime(report.generatedAt)}. Customer names are masked in this report.</p>
            {Object.keys(report.newValues).length ? (
              <div>
                <p className="font-medium">New values pending mapping (stored verbatim)</p>
                {Object.entries(report.newValues).map(([f, vals]) => (
                  <p key={f} className="text-xs">
                    <strong>{f}</strong>: {vals.join(' · ')}
                  </p>
                ))}
                {profileId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void run(() => clientApi.post(`/mis/profiles/${profileId}/known-values`, { values: report.newValues, reason: `acknowledged from batch ${batchId}` }), 'Values acknowledged on the profile.')}
                  >
                    Acknowledge as known values
                  </Button>
                ) : null}
              </div>
            ) : null}
            {Object.keys(report.blankStatusCounts).length ? (
              <p className="text-xs">
                Blank / not reported:{' '}
                {Object.entries(report.blankStatusCounts)
                  .map(([f, n]) => `${f} ${n}`)
                  .join(' · ')}
              </p>
            ) : null}
            {report.duplicateReferences.length ? <p className="text-xs">Duplicate references: {report.duplicateReferences.map((d) => `${d.reference} ×${d.rows}`).join(' · ')}</p> : null}
            {(['conflicts', 'unmatched'] as const).map((k) =>
              report.samples[k]?.length ? (
                <div key={k}>
                  <p className="font-medium capitalize">{k} (sample)</p>
                  {report.samples[k].map((s) => (
                    <p key={s.row} className="text-xs">
                      row {s.row} · {s.customer} · {s.references.map((r) => `${r.kind}=${r.value}`).join(', ')} · {s.explanation}
                    </p>
                  ))}
                </div>
              ) : null,
            )}
          </div>
        ) : null}
        {stage === 'APPLIED' && totals ? (
          <p className="text-sm">
            Applied: {totals.updatedChanged ?? 0} lead(s) changed · {totals.updatedNoChange ?? 0} confirmed unchanged · {totals.needsReview ?? 0} need review · {totals.ignored ?? 0} ignored · {totals.invalid ?? 0} invalid.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
