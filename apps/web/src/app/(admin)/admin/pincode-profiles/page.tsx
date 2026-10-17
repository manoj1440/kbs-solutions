import { DataTablePanel } from '@/components/data-table';
import { MiniStat, StatStrip } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { CoverageTable, type CoverageRow } from './profiles-table';
import { UploadCoverageButton } from './upload-coverage';

export const metadata = { title: 'Bank coverage · KBS Solutions' };

/** F-404 → F-816 Admin: which pincodes each bank sources — one upload per bank in the standard format, live at once. */
export default async function BankCoveragePage() {
  const rows = (await apiFetch<CoverageRow[]>('/pincode-coverage')).data;
  const covered = rows.filter((r) => r.live);
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Bank coverage</h1>
      <StatStrip cols={3}>
        <MiniStat label="Banks" value={rows.length} hint="Active banks" tone="sky" />
        <MiniStat label="With a coverage list" value={covered.length} hint={`${rows.length - covered.length} not uploaded yet`} tone="emerald" />
        <MiniStat label="Pincodes sourced" value={covered.reduce((n, r) => n + (r.live?.sourceable ?? 0), 0).toLocaleString('en-IN')} hint="Across all banks" tone="violet" />
      </StatStrip>
      <DataTablePanel label="Bank coverage" toolbar={<div className="flex w-full justify-end"><UploadCoverageButton banks={rows.map((r) => ({ id: r.bank.id, label: r.bank.displayName }))} /></div>}>
        <CoverageTable rows={rows} />
      </DataTablePanel>
    </div>
  );
}
