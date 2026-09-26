'use client';

import { ApiClientError } from '@kbs/shared';
import { FileUp, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Callout, SectionCard } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

import { ImportSteps } from './[id]/wizard';

/** Step (a): upload the workbook, create the batch, jump into the wizard. */
export function NewBatchCard() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <SectionCard
      icon={FileUp}
      tone="teal"
      title="New batch"
      description="XLSX or CSV with columns NAME, PAN NO, MOBILE, Pincode (no Location column — city/state is resolved from the pincode master). Re-uploading an identical file opens the existing batch."
    >
      <div className="grid gap-4">
        <ImportSteps current={0} />
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-4 py-6 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-teal-100">
            <FileUp className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Excel (.xlsx) or CSV</p>
            <p className="text-xs text-slate-500">Columns are mapped and validated in the next steps.</p>
          </div>
          <FileUploadButton
            purpose="customer_list"
            accept=".csv,.xlsx"
            label="Upload customer list"
            variant="default"
            onUploaded={async (f) => {
              try {
                const r = await clientApi.post<{ id: string; duplicateOf?: string }>('/calling-list/batches', { fileId: f.id });
                if (r.data.duplicateOf) setMsg(`Identical file already imported as ${r.data.duplicateOf}; opening it.`);
                router.push(`/admin/calling-list/${r.data.id}`);
              } catch (e) {
                setMsg(e instanceof ApiClientError ? e.message : 'Could not create the batch.');
              }
            }}
          />
        </div>
        {msg ? (
          <Callout tone="neutral" icon={Info} role="status">
            {msg}
          </Callout>
        ) : null}
      </div>
    </SectionCard>
  );
}
