import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { NewMisBatch } from './new-batch';

interface Profile {
  id: string;
  name: string;
  version: number;
  status: string;
  snapshotMode: string;
  bank: { id: string; code: string; displayName: string };
  _count: { batches: number };
}
interface Batch {
  id: string;
  publicRef: string;
  stage: string;
  uploadedAt: string;
  totals: { rows?: number; unique?: number; invalid?: number } | null;
  rejectReason: string | null;
  bank: { code: string; displayName: string };
  profile: { name: string; version: number };
  file: { originalName: string };
  uploader: { fullName: string };
}
const STAGE: Record<string, 'info' | 'warning' | 'success' | 'destructive' | 'unknown'> = { UPLOADED: 'info', PARSED: 'info', MAPPED: 'warning', PREVIEWED: 'warning', APPLYING: 'info', APPLIED: 'success', FAILED: 'destructive', REJECTED: 'unknown' };

/** F-501/F-502 Admin: MIS profiles + batches. */
export default async function MisPage() {
  const [profiles, batches] = await Promise.all([apiFetch<Profile[]>('/mis/profiles'), apiFetch<Batch[]>('/mis/batches?pageSize=50')]);
  const approved = profiles.data.filter((p) => p.status === 'APPROVED');
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Bank MIS</h1>
        <p className="text-muted-foreground text-sm">Upload, preview and apply bank-reported application files. Files are kept immutable; every cell is stored as text exactly as received.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Import profiles</CardTitle>
            <CardDescription>One per bank and version; imports run only under an APPROVED profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Batches</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{p.bank.displayName}</TableCell>
                    <TableCell>
                      <Link className="underline" href={`/admin/mis/profiles/${p.id}`}>
                        {p.name}
                      </Link>{' '}
                      <span className="text-muted-foreground text-xs">v{p.version}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'APPROVED' ? 'success' : p.status === 'DRAFT' ? 'warning' : 'unknown'}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.snapshotMode}</TableCell>
                    <TableCell>{p._count.batches}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <NewMisBatch profiles={approved.map((p) => ({ id: p.id, bankId: p.bank.id, label: `${p.bank.displayName} — ${p.name} v${p.version}` }))} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Batches</CardTitle>
          <CardDescription>{String(batches.meta.total ?? batches.data.length)} uploads.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Bank · profile</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link className="font-mono text-xs underline" href={`/admin/mis/batches/${b.id}`}>
                      {b.publicRef}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {b.bank.displayName} · {b.profile.name} v{b.profile.version}
                  </TableCell>
                  <TableCell className="text-xs">{b.file.originalName}</TableCell>
                  <TableCell className="text-xs">
                    {formatDateTime(b.uploadedAt)} · {b.uploader.fullName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STAGE[b.stage] ?? 'unknown'}>{b.stage}</Badge>
                    {b.rejectReason ? <div className="text-muted-foreground text-xs">{b.rejectReason}</div> : null}
                  </TableCell>
                  <TableCell className="text-xs">{b.totals?.rows ?? '—'}</TableCell>
                </TableRow>
              ))}
              {batches.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No MIS uploads yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
