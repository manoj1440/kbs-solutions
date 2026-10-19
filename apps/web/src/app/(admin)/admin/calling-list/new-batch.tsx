'use client';

import { ApiClientError } from '@kbs/shared';
import { FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Button } from '@/components/ui/button';
import { Callout, IconTile } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

/** F-816: pick the workbook → the server reads the fixed columns and checks every row → continue on the batch page. */
export function UploadListButton() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        size="sm"
        className="h-9"
        onClick={() => {
          setMsg(null);
          dialog.current?.showModal();
        }}
      >
        <Upload />
        Upload customer list
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="upload-list-title"
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-neutral-950/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <IconTile icon={FileSpreadsheet} tone="teal" />
            <div className="min-w-0">
              <h2 id="upload-list-title" className="text-lg font-semibold tracking-tight text-foreground">
                Upload customer list
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Excel (.xlsx) or CSV with the columns NAME, MOBILE, Pincode and optional PAN. Every row is checked before anything is imported.
              </p>
            </div>
          </div>
          <FileUploadButton
            purpose="customer_list"
            accept=".csv,.xlsx"
            label="Choose file"
            variant="default"
            onUploaded={async (f) => {
              setBusy(true);
              setMsg(null);
              try {
                const r = await clientApi.post<{ id: string; duplicateOf?: string }>('/calling-list/batches', { fileId: f.id });
                dialog.current?.close();
                router.push(`/admin/calling-list/${r.data.id}`);
              } catch (e) {
                setMsg(e instanceof ApiClientError ? e.message : 'Could not read the file.');
              } finally {
                setBusy(false);
              }
            }}
          />
          {busy ? <p className="text-xs text-muted-foreground">Checking file…</p> : null}
          {msg ? (
            <Callout tone="danger" icon={TriangleAlert} role="alert">
              {msg}
            </Callout>
          ) : null}
          <div className="flex justify-end border-t border-border-subtle pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => dialog.current?.close()}>
              Cancel
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
