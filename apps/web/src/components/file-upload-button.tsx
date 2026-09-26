'use client';

import { ApiClientError } from '@kbs/shared';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';

/** Uploads to `POST /files/:purpose` then hands the stored file id to `onUploaded`. */
export function FileUploadButton({ purpose, accept, label, onUploaded, variant = 'outline' }: { purpose: string; accept: string; label: string; variant?: 'outline' | 'default'; onUploaded: (file: { id: string; originalName: string }) => void | Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          setError(null);
          try {
            const fd = new FormData();
            fd.append('file', f);
            const r = await clientApi.post<{ id: string; originalName: string }>(`/files/${purpose}`, fd);
            await onUploaded(r.data);
          } catch (err) {
            setError(err instanceof ApiClientError ? err.message : 'Upload failed.');
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = '';
          }
        }}
      />
      <Button type="button" variant={variant} disabled={busy} onClick={() => ref.current?.click()}>
        <Upload className={busy ? 'animate-bounce' : undefined} />
        {busy ? 'Uploading…' : label}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      ) : null}
    </span>
  );
}
