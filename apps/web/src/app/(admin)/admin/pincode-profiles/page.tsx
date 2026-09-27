import { formatDateTime } from '@kbs/shared';
import { Building2, CheckCircle2, FilePen, Layers, MapPin } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { BankMark, EmptyState, humanize, PageHeader, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface Profile {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
  sheetName: string | null;
  pincodeColumn: string;
  semantics: { rule: string };
  approvedAt: string | null;
  bank: { code: string; displayName: string };
  _count: { batches: number };
}

/** F-404 Admin: bank pincode profiles. */
export default async function PincodeProfilesPage() {
  const p = await apiFetch<Profile[]>('/pincode-profiles');
  const approved = p.data.filter((r) => r.status === 'APPROVED');
  const drafts = p.data.filter((r) => r.status === 'DRAFT').length;
  const banksApproved = new Set(approved.map((r) => r.bank.code)).size;
  const batches = p.data.reduce((n, r) => n + r._count.batches, 0);
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={MapPin}
        eyebrow="Products"
        tone="violet"
        title="Bank pincode profiles"
        description="One profile per bank sheet structure (REQ-07 §7.2). A bank only becomes sourceable for a pincode once its profile is APPROVED and a batch is imported under it. Rules marked “requires bank mapping” never make a pincode available."
      >
        <StatGrid>
          <StatCard label="Profile versions" value={p.data.length} hint={`${new Set(p.data.map((r) => r.bank.code)).size} banks with a profile`} icon={Layers} tone="violet" />
          <StatCard label="Approved" value={approved.length} hint={`${banksApproved} bank${banksApproved === 1 ? '' : 's'} with an approved profile`} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Drafts" value={drafts} hint="Not used for sourceability until approved" icon={FilePen} tone={drafts ? 'amber' : 'slate'} />
          <StatCard label="Batches" value={batches} hint="Uploaded across all profile versions" icon={Building2} tone="indigo" />
        </StatGrid>
      </PageHeader>
      <SectionCard icon={MapPin} tone="violet" title="Profiles" description={`${p.data.length} profile versions.`} flush={p.data.length > 0}>
        {p.data.length === 0 ? (
          <EmptyState icon={MapPin} title="No pincode profiles yet" description="No bank is sourceable for any pincode until a profile is approved and a batch imported under it." />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sheet · pincode column</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead className="text-right">Batches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell data-label="Bank">
                    <div className="flex items-center gap-2.5">
                      <BankMark code={r.bank.code} size="sm" />
                      <span className="font-medium text-slate-800">{r.bank.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell data-label="Profile">
                    <Link href={`/admin/pincode-profiles/${r.id}`}>{r.name}</Link> <span className="text-[11px] text-slate-500">v{r.version}</span>
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'DRAFT' ? 'warning' : 'unknown'}>{humanize(r.status)}</Badge>
                    {r.approvedAt ? <div className="mt-1 text-[11px] text-slate-500">{formatDateTime(r.approvedAt)}</div> : null}
                  </TableCell>
                  <TableCell data-label="Sheet · pincode column">
                    <span className="font-mono text-xs">
                      {r.sheetName ?? '(first)'} · {r.pincodeColumn}
                    </span>
                  </TableCell>
                  <TableCell data-label="Rule">
                    <Badge variant={r.semantics.rule === 'REQUIRES_BANK_MAPPING' ? 'warning' : 'secondary'}>{humanize(r.semantics.rule)}</Badge>
                  </TableCell>
                  <TableCell data-label="Batches" className="tabular-nums sm:text-right">
                    {r._count.batches}
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
