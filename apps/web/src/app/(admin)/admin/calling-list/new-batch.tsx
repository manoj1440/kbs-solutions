'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clientApi } from '@/lib/client-api';

/** Step (a): upload the workbook, create the batch, jump into the wizard. */
export function NewBatchCard() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>New batch</CardTitle>
        <CardDescription>XLSX or CSV with columns NAME, PAN NO, MOBILE, Pincode (no Location column — city/state is resolved from the pincode master). Re-uploading an identical file opens the existing batch.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <FileUploadButton
          purpose="customer_list"
          accept=".csv,.xlsx"
          label="Upload customer list"
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
        {msg ? <p className="text-sm">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
