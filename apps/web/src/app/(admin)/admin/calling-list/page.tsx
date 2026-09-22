import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer calling lists</h1>
        <p className="text-muted-foreground text-sm">Upload → map columns → validate → confirm. Every batch keeps its file, uploader and time; rows are never redistributed automatically.</p>
      </div>
      <NewBatchCard />
      <Card>
        <CardHeader>
          <CardTitle>Batches</CardTitle>
          <CardDescription>{String(b.meta.total ?? b.data.length)} batches.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Imported / review / excluded</TableHead>
                <TableHead>Allocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No batches yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {b.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link className="font-mono text-xs underline" href={`/admin/calling-list/${r.id}`}>
                      {r.publicRef}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{r.file}</TableCell>
                  <TableCell className="text-xs">
                    {formatDateTime(r.uploadedAt)} · {r.uploader}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'unknown'}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.status === 'IMPORTED' ? `${r.totals?.imported ?? 0} / ${r.totals?.needsReview ?? 0} / ${r.totals?.excluded ?? 0}` : r.totals?.rows ? `${r.totals.rows} rows` : '—'}</TableCell>
                  <TableCell className="text-xs">{r.allocatedAt ? `allocated ${formatDateTime(r.allocatedAt)}` : r.status === 'IMPORTED' ? (r.attested ? 'pending' : 'blocked: consent not confirmed') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
