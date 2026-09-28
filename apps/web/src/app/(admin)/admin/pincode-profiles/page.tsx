import { formatDateTime } from '@kbs/shared';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { BankMark, EmptyState, humanize, MiniStat } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Bank coverage · KBS Solutions' };

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

/** F-404 → F-811 Admin: bank pincode profiles — tiles + internal-scroll table. */
export default async function PincodeProfilesPage() {
  const p = await apiFetch<Profile[]>('/pincode-profiles');
  const approved = p.data.filter((r) => r.status === 'APPROVED');
  const drafts = p.data.filter((r) => r.status === 'DRAFT').length;
  const banksApproved = new Set(approved.map((r) => r.bank.code)).size;
  const batches = p.data.reduce((n, r) => n + r._count.batches, 0);
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Bank pincode profiles</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Profile versions" value={p.data.length} hint={`${new Set(p.data.map((r) => r.bank.code)).size} banks`} tone="sky" />
        <MiniStat label="Approved" value={approved.length} hint={`${banksApproved} bank${banksApproved === 1 ? '' : 's'} sourceable`} tone="emerald" />
        <MiniStat label="Drafts" value={drafts} hint="Not sourceable until approved" tone={drafts ? 'amber' : 'slate'} />
        <MiniStat label="Batches imported" value={batches} hint="Across all versions" tone="violet" />
      </div>
      <section aria-label="Profiles" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="min-h-0 flex-1">
          {p.data.length === 0 ? (
            <EmptyState icon={MapPin} className="m-3" title="No pincode profiles yet" description="No bank is sourceable for any pincode until a profile is approved and a batch imported under it." />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Bank</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sheet · pincode column</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead className="pr-4 text-right">Batches</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4" data-label="Bank">
                      <div className="flex items-center gap-2.5">
                        <BankMark code={r.bank.code} size="sm" />
                        <span className="font-medium text-slate-800">{r.bank.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell data-label="Profile">
                      <Link className="font-medium text-slate-900 hover:text-teal-700" href={`/admin/pincode-profiles/${r.id}`}>{r.name}</Link>{' '}
                      <span className="text-[11px] text-slate-500">v{r.version}</span>
                    </TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'DRAFT' ? 'warning' : 'unknown'}>{humanize(r.status)}</Badge>
                      {r.approvedAt ? <div className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(r.approvedAt)}</div> : null}
                    </TableCell>
                    <TableCell data-label="Sheet · pincode column">
                      <span className="font-mono text-xs">
                        {r.sheetName ?? '(first)'} · {r.pincodeColumn}
                      </span>
                    </TableCell>
                    <TableCell data-label="Rule">
                      <Badge variant={r.semantics.rule === 'REQUIRES_BANK_MAPPING' ? 'warning' : 'secondary'}>{humanize(r.semantics.rule)}</Badge>
                    </TableCell>
                    <TableCell data-label="Batches" className="pr-4 tabular-nums sm:text-right">
                      {r._count.batches}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 items-center border-t border-slate-100 px-4 py-2 text-xs text-slate-500 tabular-nums">
          {p.data.length} profile version{p.data.length === 1 ? '' : 's'}
        </div>
      </section>
    </div>
  );
}
