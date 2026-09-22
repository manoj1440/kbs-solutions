'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

export function NewMisBatch({ profiles }: { profiles: { id: string; bankId: string; label: string }[] }) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const chosen = profiles.find((p) => p.id === profileId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload MIS</CardTitle>
        <CardDescription>Choose the bank profile, then the workbook. Pincode sheets and calling lists are rejected automatically.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {profiles.length === 0 ? <p className="text-destructive text-sm">No approved MIS profile yet — approve one first.</p> : null}
        <Label htmlFor="mis-profile">Bank · profile</Label>
        <select id="mis-profile" className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <FileUploadButton
          purpose="mis"
          accept=".xlsx,.csv"
          label="Upload MIS workbook"
          onUploaded={async (f) => {
            if (!chosen) return;
            try {
              const r = await clientApi.post<{ id: string; duplicateOf?: string }>('/mis/batches', { bankId: chosen.bankId, profileId: chosen.id, fileId: f.id });
              if (r.data.duplicateOf) setMsg(`Identical file already uploaded as ${r.data.duplicateOf}; opening it.`);
              router.push(`/admin/mis/batches/${r.data.id}`);
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
