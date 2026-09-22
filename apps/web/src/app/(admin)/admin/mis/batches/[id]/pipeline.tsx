'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

/** F-503 preview tiles + F-505 apply. */
export function PipelineActions({ batchId, stage, report, totals, profileId }: { batchId: string; stage: string; report: PreviewReport | null; totals: Record<string, number> | null; profileId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };
  const canPreview = stage === 'MAPPED' || stage === 'PREVIEWED';
  const canApply = stage === 'PREVIEWED' || stage === 'FAILED';
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
