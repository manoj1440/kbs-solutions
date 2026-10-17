'use client';

import { ApiClientError } from '@kbs/shared';
import { CircleAlert, Loader2, RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

export interface MisJob {
  kind: 'PREVIEW' | 'APPLY' | null;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | null;
  progress: { phase: string; done: number; total: number } | null;
  error: string | null;
  queuedAt: string | null;
}
const active = (j: MisJob | null) => j?.status === 'QUEUED' || j?.status === 'RUNNING';

/** F-816: a large upload applies in the background (F-508) — poll until done, then refresh the page. */
function Progress({ batchId, job }: { batchId: string; job: MisJob }) {
  const router = useRouter();
  const [j, setJ] = useState(job);
  useEffect(() => {
    if (!active(j)) return;
    const t = setTimeout(async () => {
      try {
        const next = (await clientApi.get<{ job: MisJob }>(`/mis/batches/${batchId}/job`)).data.job;
        setJ(next);
        if (!active(next)) router.refresh();
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [j, batchId, router]);
  const p = j.progress;
  const pct = p && p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
  return (
    <div className="grid gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-sky-950">
        <span className="inline-flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin text-sky-600" aria-hidden="true" />
          Updating leads…
        </span>
        <span className="text-ui tabular-nums">{p ? `${p.done.toLocaleString('en-IN')} / ${p.total.toLocaleString('en-IN')}` : ''}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-card ring-1 ring-sky-100">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-sky-900/80">You can leave this page; you will get a notification when it finishes.</span>
    </div>
  );
}

/** F-816: the upload modal applies straight away; this only shows progress, or a retry when that apply did not finish. */
export function UploadStatus({ batchId, stage, job: initialJob }: { batchId: string; stage: string; job: MisJob | null }) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (job && active(job)) return <Progress key={job.queuedAt ?? 'job'} batchId={batchId} job={job} />;
  if (!['MAPPED', 'PREVIEWED', 'FAILED'].includes(stage)) return null;
  const retry = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await clientApi.post<{ queued?: boolean; job?: MisJob }>(`/mis/batches/${batchId}/apply`, {});
      if (r.data.queued && r.data.job) setJob(r.data.job);
      else router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Could not update the leads.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Callout tone="warning" icon={CircleAlert} role="alert">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{job?.status === 'FAILED' && job.error ? `The update stopped: ${job.error}. Leads already updated are kept.` : 'The file was read but the leads are not updated yet.'}</span>
        <Button size="sm" disabled={busy} onClick={() => void retry()}>
          <RotateCw />
          {busy ? 'Updating…' : 'Update leads'}
        </Button>
      </div>
      {msg ? <p className="mt-2 text-sm">{msg}</p> : null}
    </Callout>
  );
}
