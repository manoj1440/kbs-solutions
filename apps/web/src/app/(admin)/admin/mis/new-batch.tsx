'use client';

import { ApiClientError } from '@kbs/shared';
import { FileUp, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Button } from '@/components/ui/button';
import { selectClass } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

/**
 * F-809: one-step MIS import — pick the bank, drop the standard-format workbook, done. The server resolves the bank's
 * approved profile, parses + maps on create, and the modal then triggers apply (match runs inside apply). Large files
 * become a background job; either way the batch page shows the result.
 */
export function UploadMisButton({ banks }: { banks: { id: string; label: string }[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [bankId, setBankId] = useState(banks[0]?.id ?? '');
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
        disabled={banks.length === 0}
        title={banks.length === 0 ? 'No bank has an approved MIS profile yet' : undefined}
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
        className={cn('fixed top-1/2 left-1/2 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40', open ? '' : 'hidden')}
        onClose={() => setOpen(false)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <FileUp className="size-4.5" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-slate-900">Upload MIS</p>
          </div>
          <button type="button" aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => setOpen(false)}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-5">
          <div className="grid gap-1.5">
            <label htmlFor="mis-bank" className="text-xs font-medium text-slate-600">
              Bank
            </label>
            <select id="mis-bank" className={selectClass} value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-4 py-6 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-teal-100">
              <FileUp className="size-5" aria-hidden="true" />
            </span>
            <p className="text-xs text-slate-500">Excel (.xlsx) or CSV in the standard MIS layout — columns are recognised automatically.</p>
            <FileUploadButton
              purpose="mis"
              accept=".xlsx,.csv"
              label={busy ? 'Importing…' : 'Choose file'}
              variant="default"
              onUploaded={async (f) => {
                setBusy(true);
                setMsg(null);
                try {
                  const r = await clientApi.post<{ id: string; stage?: string; duplicateOf?: string }>('/mis/batches', { bankId, fileId: f.id });
                  if (!r.data.duplicateOf && r.data.stage !== 'REJECTED') {
                    try {
                      await clientApi.post(`/mis/batches/${r.data.id}/apply`, {});
                    } catch {
                      /* apply validation lives on the batch page */
                    }
                  }
                  router.push(`/admin/mis/batches/${r.data.id}`);
                } catch (e) {
                  setMsg(e instanceof ApiClientError ? e.message : 'Could not create the batch.');
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
