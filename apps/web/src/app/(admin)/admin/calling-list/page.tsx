import { formatDateTime } from '@kbs/shared';
import { CheckCircle2, FileSpreadsheet, ListChecks, Phone, ShieldAlert, Users } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, humanize, PageHeader, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { NewBatchCard } from './new-batch';

interface BatchRow {
  id: string;
  publicRef: string;
  status: string;
  file: string;
  uploader: string;
  uploadedAt: string;
  totals: { rows?: number; imported?: number; needsReview?: number; excluded?: number } | null;
  allocatedAt: string | null;
  attested: boolean;
}

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'destructive' | 'unknown'> = { UPLOADED: 'info', VALIDATED: 'warning', IMPORTED: 'success', FAILED: 'destructive', REJECTED: 'unknown' };

/** F-303 Admin: customer calling-list batches (REQ-06 §6.2 batch list). */
export default async function CallingListPage() {
  const b = await apiFetch<BatchRow[]>('/calling-list/batches?pageSize=50');
  const total = Number(b.meta.total ?? b.data.length);
  const imported = b.data.filter((r) => r.status === 'IMPORTED');
  const records = imported.reduce((n, r) => n + (r.totals?.imported ?? 0), 0);
  const review = imported.reduce((n, r) => n + (r.totals?.needsReview ?? 0), 0);
  const blocked = imported.filter((r) => !r.allocatedAt && !r.attested).length;
  const inProgress = b.data.filter((r) => r.status === 'UPLOADED' || r.status === 'VALIDATED').length;
  const scope = total > b.data.length ? `Of the latest ${b.data.length} batches` : 'Across all batches';
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Phone}
        eyebrow="Sales operations"
        title="Customer calling lists"
        description="Upload → map columns → validate → confirm. Every batch keeps its file, uploader and time; rows are never redistributed automatically."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/calling-list/distribution">
              <Users />
              Calling allocation
            </Link>
          </Button>
        }
      >
        <StatGrid>
          <StatCard label="Batches" value={total} hint={inProgress ? `${inProgress} still being mapped or validated` : 'All uploads, newest first'} icon={FileSpreadsheet} tone="sky" />
          <StatCard label="Records imported" value={records} hint={`${scope} · ${imported.length} imported batch${imported.length === 1 ? '' : 'es'}`} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Rows in review" value={review} hint={`${scope} · accept or exclude with a reason`} icon={ListChecks} tone={review ? 'amber' : 'slate'} />
          <StatCard label="Allocation blocked" value={blocked} hint={`${scope} · consent not confirmed`} icon={ShieldAlert} tone={blocked ? 'rose' : 'slate'} />
        </StatGrid>
      </PageHeader>
      <NewBatchCard />
      <SectionCard icon={FileSpreadsheet} tone="sky" title="Batches" description={`${String(b.meta.total ?? b.data.length)} batches.`} flush={b.data.length > 0}>
        {b.data.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No batches yet." description="Upload the first customer list above. Nothing is allocated until the mapping is validated and the import is confirmed." />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sm:text-right">Imported / review / excluded</TableHead>
                <TableHead>Allocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell data-label="Ref">
                    <Link className="font-mono text-xs" href={`/admin/calling-list/${r.id}`}>
                      {r.publicRef}
                    </Link>
                  </TableCell>
                  <TableCell data-label="File">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                      <FileSpreadsheet className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="break-all">{r.file}</span>
                    </span>
                  </TableCell>
                  <TableCell data-label="Uploaded" className="text-xs">
                    {formatDateTime(r.uploadedAt)}
                    <div className="text-[11px] text-slate-500">by {r.uploader}</div>
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'unknown'}>{humanize(r.status)}</Badge>
                  </TableCell>
                  <TableCell data-label="Imported / review / excluded" className="text-xs tabular-nums sm:text-right">
                    {r.status === 'IMPORTED' ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-semibold text-emerald-700">{r.totals?.imported ?? 0}</span>/<span className="font-semibold text-amber-700">{r.totals?.needsReview ?? 0}</span>/
                        <span className="text-slate-500">{r.totals?.excluded ?? 0}</span>
                      </span>
                    ) : r.totals?.rows ? (
                      `${r.totals.rows} rows`
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell data-label="Allocation" className="text-xs">
                    {r.allocatedAt ? (
                      <span className="text-slate-700">allocated {formatDateTime(r.allocatedAt)}</span>
                    ) : r.status === 'IMPORTED' ? (
                      r.attested ? (
                        <Badge variant="warning">pending</Badge>
                      ) : (
                        <Badge variant="destructive">blocked: consent not confirmed</Badge>
                      )
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
