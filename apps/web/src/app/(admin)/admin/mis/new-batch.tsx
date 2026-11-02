'use client';

import { ApiClientError } from '@kbs/shared';
import { FileUp, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

/**
 * F-809/F-816: one-step MIS import — choose the file, done (bank-independent: it only updates the matching leads' status). Standard format,
 * so there is nothing to map; the modal creates the batch and applies it (match runs inside apply). Large files become a
 * background job; either way the upload page shows what changed.
 */
export function UploadMisButton() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <Button
        type="button"
        size="sm"
        className="h-9 shrink-0"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
      >
        <Upload />
        Upload MIS
      </Button>
      <dialog
        ref={ref}
        aria-label="Upload MIS"
        className={cn('fixed top-1/2 left-1/2 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 glass-strong rounded-[28px] p-0 backdrop:bg-black/45', open ? '' : 'hidden')}
        onClose={() => setOpen(false)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-stone-100 text-stone-900 ring-1 ring-stone-200">
              <FileUp className="size-4.5" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-foreground">Upload MIS</p>
          </div>
          <button type="button" aria-label="Close" className="rounded-lg p-1.5 text-fg-3 hover:bg-muted hover:text-fg-2" onClick={() => setOpen(false)}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-5">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-stone-100/40 px-4 py-6 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-card text-stone-900 shadow-sm ring-1 ring-stone-200">
              <FileUp className="size-5" aria-hidden="true" />
            </span>
            <p className="text-xs text-muted-foreground">The MIS file, Excel (.xlsx) or CSV. Matching leads’ statuses update as soon as it is read.</p>
            <FileUploadButton
              purpose="mis"
              accept=".xlsx,.csv"
              label={busy ? 'Importing…' : 'Choose file'}
              variant="default"
              onUploaded={async (f) => {
                setBusy(true);
                setMsg(null);
                try {
                  const r = await clientApi.post<{ id: string; stage?: string; duplicateOf?: string }>('/mis/batches', { fileId: f.id });
                  if (!r.data.duplicateOf && r.data.stage !== 'REJECTED') {
                    try {
                      await clientApi.post(`/mis/batches/${r.data.id}/apply`, {});
                    } catch {
                      /* the upload page offers "Update leads" again */
                    }
                  }
                  router.push(`/admin/mis/batches/${r.data.id}`);
                } catch (e) {
                  setMsg(e instanceof ApiClientError ? e.message : 'Could not read the file.');
                  setBusy(false);
                }
              }}
            />
          </div>
          {msg ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {msg}
            </p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
