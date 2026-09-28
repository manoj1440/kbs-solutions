import { DataTablePanel } from '@/components/data-table';
import { MiniStat } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { PincodeProfilesTable, type PincodeProfileRow } from './profiles-table';

export const metadata = { title: 'Bank coverage · KBS Solutions' };

/** F-404 → F-811 Admin: bank pincode profiles — tiles + internal-scroll table. */
export default async function PincodeProfilesPage() {
  const p = await apiFetch<PincodeProfileRow[]>('/pincode-profiles');
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
      <DataTablePanel
        label="Profiles"
        footer={
          <div className="flex shrink-0 items-center border-t border-slate-100 px-4 py-2 text-xs text-slate-500 tabular-nums">
            {p.data.length} profile version{p.data.length === 1 ? '' : 's'}
          </div>
        }
      >
        <PincodeProfilesTable rows={p.data} />
      </DataTablePanel>
    </div>
  );
}
