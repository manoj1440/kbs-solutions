'use client';

import { ApiClientError } from '@kbs/shared';
import { FileUp, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Callout, Field, SectionCard, selectClass } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

export function NewMisBatch({ profiles }: { profiles: { id: string; bankId: string; label: string }[] }) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const chosen = profiles.find((p) => p.id === profileId);
  return (
    <SectionCard
      icon={FileUp}
      tone="teal"
      title="Upload MIS"
      description="Choose the bank profile, then the workbook. Pincode sheets and calling lists are rejected automatically."
    >
      <div className="grid gap-4">
        {profiles.length === 0 ? (
          <Callout tone="warning" icon={Info}>
            No approved MIS profile yet — approve one first.
          </Callout>
        ) : null}
        <Field label="Bank · profile" htmlFor="mis-profile">
          <select id="mis-profile" className={selectClass} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-4 py-6 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-teal-100">
            <FileUp className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Excel (.xlsx) or CSV</p>
            <p className="text-xs text-slate-500">Stored immutably; every cell kept as text exactly as received.</p>
          </div>
          <FileUploadButton
            purpose="mis"
            accept=".xlsx,.csv"
            label="Upload MIS workbook"
            variant="default"
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
        </div>
        {msg ? <p className="text-sm">{msg}</p> : null}
      </div>
    </SectionCard>
  );
}
