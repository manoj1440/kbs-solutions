import { formatDateTime } from '@kbs/shared';
import { Ban, FileSpreadsheet } from 'lucide-react';

import { BankMark, Callout, DetailHeader, StatCard, StatGrid } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { type MisJob, UploadStatus } from './result';
import { BatchRows } from './rows';

export const metadata = { title: 'MIS upload · KBS Solutions' };

interface Batch {
  id: string;
  publicRef: string;
  stage: string;
  uploadedAt: string;
  totals: Record<string, number> | null;
  rejectReason: string | null;
  bank: { code: string; displayName: string };
  file: { originalName: string };
  uploader: { fullName: string };
}

/** F-816: one MIS upload = what it did to the leads. The file is in the standard format, so there is nothing to map or review. */
export default async function MisBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [b, job] = await Promise.all([apiFetch<Batch>(`/mis/batches/${id}`).then((r) => r.data), apiFetch<{ job: MisJob }>(`/mis/batches/${id}/job`).then((r) => r.data.job)]);
  const t = b.totals ?? {};
  const notLinked = (t.unmatched ?? 0) + (t.conflicts ?? 0) + (t.invalid ?? 0);
  return (
    <div className="grid gap-6">
      <DetailHeader
        back={{ href: '/admin/mis', label: 'Bank MIS upload' }}
        visual={<BankMark code={b.bank.code} />}
        title={`${b.bank.displayName} MIS`}
        subtitle={`${b.file.originalName} · uploaded by ${b.uploader.fullName} · ${formatDateTime(b.uploadedAt)}`}
      />
      {b.stage === 'REJECTED' ? (
        <Callout tone="danger" icon={Ban} role="alert">
          This file is not the bank MIS: {b.rejectReason} Upload the MIS file the bank sent.
        </Callout>
      ) : (
        <>
          <UploadStatus batchId={b.id} stage={b.stage} job={job} />
          {b.stage === 'APPLIED' ? (
            <StatGrid>
              <StatCard label="Rows in file" value={t.rows ?? 0} icon={FileSpreadsheet} tone="sky" />
              <StatCard label="Leads updated" value={t.updatedChanged ?? 0} hint="Bank status changed" tone="emerald" />
              <StatCard label="Leads unchanged" value={t.updatedNoChange ?? 0} hint="Same status as before" tone="slate" />
              <StatCard label="No KBS lead" value={notLinked} hint="Application not raised through KBS" tone="slate" />
            </StatGrid>
          ) : null}
          <BatchRows batchId={b.id} stage={b.stage} />
        </>
      )}
    </div>
  );
}
