import { formatDateTime } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

import { PipelineActions } from './pipeline';
import { BatchRows } from './rows';

interface PreviewReport {
  generatedAt: string;
  totals: Record<string, number>;
  referenceCoverage: number;
  blankStatusCounts: Record<string, number>;
  newValues: Record<string, string[]>;
  duplicateReferences: { reference: string; rows: number }[];
  samples: Record<string, { row: number; customer: string; references: { kind: string; value: string }[]; explanation: string | null }[]>;
}
interface Batch {
  id: string;
  publicRef: string;
  stage: string;
  uploadedAt: string;
  sheetName: string | null;
  totals: Record<string, unknown> | null;
  preview: { headers?: string[]; resolved?: Record<string, string>; missing?: string[]; unmapped?: string[]; report?: PreviewReport } | null;
  rejectReason: string | null;
  appliedAt: string | null;
  bank: { displayName: string };
  profile: { id: string; name: string; version: number; snapshotMode: string };
  file: { originalName: string; sizeBytes: number };
  uploader: { fullName: string; role: string };
}

export default async function MisBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await apiFetch<Batch>(`/mis/batches/${id}`)).data;
  const totals = (b.totals ?? {}) as { rows?: number; unique?: number; duplicateRows?: number; invalid?: number; missingHeaders?: string[]; unmappedColumns?: string[] };
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">MIS batch {b.publicRef}</h1>
        <Badge variant={b.stage === 'APPLIED' ? 'success' : b.stage === 'REJECTED' || b.stage === 'FAILED' ? 'destructive' : 'warning'}>{b.stage}</Badge>
        <span className="text-muted-foreground text-sm">
          {b.bank.displayName} · {b.profile.name} v{b.profile.version} ({b.profile.snapshotMode}) · {b.file.originalName} · sheet “{b.sheetName}” · uploaded {formatDateTime(b.uploadedAt)} by {b.uploader.fullName}
        </span>
      </div>
      {b.rejectReason ? <p className="text-destructive rounded-md border p-3 text-sm">Rejected: {b.rejectReason}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Parse & map</CardTitle>
          <CardDescription>Every cell stored as text; rows hashed; references extracted in profile order.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <p>
            Rows {totals.rows ?? '—'} · unique {totals.unique ?? '—'} · duplicate rows {totals.duplicateRows ?? 0} · no reference {totals.invalid ?? 0}
          </p>
          {totals.missingHeaders?.length ? <p className="text-warning">Profile headers not found in file: {totals.missingHeaders.join(', ')}</p> : null}
          {totals.unmappedColumns?.length ? <p className="text-muted-foreground">Unmapped columns kept in raw: {totals.unmappedColumns.join(', ')}</p> : null}
        </CardContent>
      </Card>
      <PipelineActions batchId={b.id} stage={b.stage} report={b.preview?.report ?? null} totals={b.totals as Record<string, number> | null} profileId={b.profile.id} />
      <BatchRows batchId={b.id} stage={b.stage} />
    </div>
  );
}
