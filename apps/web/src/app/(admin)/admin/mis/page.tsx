import { formatDateTime } from '@kbs/shared';
import { CheckCircle2, FileSpreadsheet, Layers, ShieldCheck, TriangleAlert, Upload } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BankMark, EmptyState, humanize, PageHeader, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
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
  const total = Number(batches.meta.total ?? batches.data.length);
  const applied = batches.data.filter((b) => b.stage === 'APPLIED').length;
  const inFlight = batches.data.filter((b) => !['APPLIED', 'FAILED', 'REJECTED'].includes(b.stage)).length;
  const problems = batches.data.filter((b) => b.stage === 'FAILED' || b.stage === 'REJECTED').length;
  const scope = total > batches.data.length ? `Of the latest ${batches.data.length} uploads` : 'Across all uploads';
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={FileSpreadsheet}
        eyebrow="Bank data & finance"
        title="Bank MIS"
        description="Upload, preview and apply bank-reported application files. Files are kept immutable; every cell is stored as text exactly as received."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/mis/integrity">
              <ShieldCheck />
              Data integrity
            </Link>
          </Button>
        }
      >
        <StatGrid>
          <StatCard label="Approved profiles" value={approved.length} hint={`${profiles.data.length} profile${profiles.data.length === 1 ? '' : 's'} in total`} icon={Layers} tone="indigo" />
          <StatCard label="Uploads" value={total} hint="All batches, newest first" icon={Upload} tone="sky" />
          <StatCard label="Applied" value={applied} hint={scope} icon={CheckCircle2} tone="emerald" />
          <StatCard label={inFlight ? 'In progress' : 'Failed or rejected'} value={inFlight || problems} hint={`${scope} · ${inFlight ? 'not yet applied' : 'nothing applied from these'}`} icon={TriangleAlert} tone={inFlight || problems ? 'amber' : 'slate'} />
        </StatGrid>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <SectionCard icon={Layers} tone="indigo" title="Import profiles" description="One per bank and version; imports run only under an approved profile." flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Batches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <BankMark code={p.bank.code} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/admin/mis/profiles/${p.id}`}>{p.name}</Link>
                        <div className="text-[11px] text-slate-500">
                          {p.bank.displayName} · v{p.version}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'APPROVED' ? 'success' : p.status === 'DRAFT' ? 'warning' : 'unknown'}>{humanize(p.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">{humanize(p.snapshotMode)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p._count.batches}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
        <NewMisBatch profiles={approved.map((p) => ({ id: p.id, bankId: p.bank.id, label: `${p.bank.displayName} — ${p.name} v${p.version}` }))} />
      </div>
      <SectionCard icon={FileSpreadsheet} tone="sky" title="Batches" description={`${total} upload${total === 1 ? '' : 's'}. Open a batch to parse, map, preview and apply.`} flush={batches.data.length > 0}>
        {batches.data.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No MIS uploads yet" description="Upload the first bank workbook above. Nothing changes on any lead until a batch is previewed and applied." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Bank · profile</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link className="font-mono text-xs" href={`/admin/mis/batches/${b.id}`}>
                      {b.publicRef}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <FileSpreadsheet className="size-3" />
                      {b.file.originalName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <BankMark code={b.bank.code} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">{b.bank.displayName}</div>
                        <div className="text-[11px] text-slate-500">
                          {b.profile.name} v{b.profile.version}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDateTime(b.uploadedAt)}
                    <div className="text-[11px] text-slate-500">by {b.uploader.fullName}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STAGE[b.stage] ?? 'unknown'}>{humanize(b.stage)}</Badge>
                    {b.rejectReason ? <div className="mt-1 text-[11px] text-slate-500">{b.rejectReason}</div> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.totals?.rows ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
