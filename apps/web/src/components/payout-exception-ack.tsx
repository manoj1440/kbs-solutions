'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

/** F-606: acknowledge a derived payout exception with a reason (audited; never moves money). */
export function AcknowledgeException({ kind, subjectId }: { kind: string; subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Acknowledge
      </Button>
    );
  return (
    <div className="grid min-w-48 gap-1">
      <Input aria-label="Resolution reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={busy || reason.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await clientApi.post('/payouts/exceptions/resolve', { kind, subjectId, reason: reason.trim() });
              router.refresh();
            } catch (e) {
              setErr(e instanceof ApiClientError ? e.message : 'Could not resolve.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {err ? <span className="text-destructive text-xs">{err}</span> : null}
    </div>
  );
}
