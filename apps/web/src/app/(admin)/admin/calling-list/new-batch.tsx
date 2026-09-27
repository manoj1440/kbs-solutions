'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { clientApi } from '@/lib/client-api';

/** Step (a): upload the workbook, create the batch, jump into the mapping wizard (re-uploading an identical file opens the existing batch). */
export function UploadListButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
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
      {msg ? (
        <span role="status" className="max-w-72 text-right text-xs text-slate-600">
          {msg}
        </span>
      ) : null}
    </span>
  );
}
