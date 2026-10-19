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

/** F-816: pick the bank, choose its coverage list (a Pincode column), done — it is live as soon as it is read. */
export function UploadCoverageButton({ banks }: { banks: { id: string; label: string }[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [bankId, setBankId] = useState(banks[0]?.id ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const bankName = banks.find((b) => b.id === bankId)?.label ?? 'The bank';
  return (
    <>
      <Button
        type="button"
        size="sm"
        className="h-9 shrink-0"
        disabled={banks.length === 0}
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
      >
        <Upload />
        Upload coverage
      </Button>
      <dialog
        ref={ref}
        aria-label="Upload coverage"
        className={cn('fixed top-1/2 left-1/2 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 glass-strong rounded-[28px] p-0 backdrop:bg-black/45', open ? '' : 'hidden')}
        onClose={() => setOpen(false)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-stone-100 text-stone-900 ring-1 ring-stone-200">
              <FileUp className="size-4.5" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-foreground">Upload coverage</p>
          </div>
          <button type="button" aria-label="Close" className="rounded-lg p-1.5 text-fg-3 hover:bg-muted hover:text-fg-2" onClick={() => setOpen(false)}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-5">
          <div className="grid gap-1.5">
            <label htmlFor="coverage-bank" className="text-xs font-medium text-fg-2">
              Bank
            </label>
            <select id="coverage-bank" className={selectClass} value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-stone-100/40 px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground">Excel (.xlsx) or CSV with a Pincode column listing every pincode the bank sources. It replaces the bank’s current list.</p>
            <FileUploadButton
              purpose="bank_pincode"
              accept=".xlsx,.csv"
              label={busy ? 'Uploading…' : 'Choose file'}
              variant="default"
              onUploaded={async (f) => {
                setBusy(true);
                setMsg(null);
                try {
                  const r = await clientApi.post<{ rowCount: number | null; counts: { sourceable: number } | null; duplicateOf?: string }>('/pincode-coverage', { bankId, fileId: f.id });
                  const n = r.data.counts?.sourceable ?? 0;
                  setMsg({ ok: true, text: r.data.duplicateOf ? 'This file is already the bank’s list.' : `${bankName}: ${n.toLocaleString('en-IN')} pincode${n === 1 ? '' : 's'} now sourceable.` });
                  router.refresh();
                } catch (e) {
                  setMsg({ ok: false, text: e instanceof ApiClientError ? e.message : 'Could not read the file.' });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
          {msg ? (
            <p role={msg.ok ? 'status' : 'alert'} className={cn('rounded-lg border px-3 py-2 text-sm', msg.ok ? 'border-teal-200 bg-teal-50 text-teal-950' : 'border-amber-200 bg-amber-50 text-amber-950')}>
              {msg.text}
            </p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
