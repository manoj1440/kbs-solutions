'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

export function ReactivateButton({ telecallerId, windowHours }: { telecallerId: string; windowHours: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await clientApi.post(`/telecallers/${telecallerId}/training/reactivate`, { reason });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Reactivation failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>Reactivate training</Button>;
  return (
    <div className="grid max-w-md gap-3 rounded-md border p-3">
      <p className="text-sm">
        {windowHours === null ? (
          <span className="text-warning">The new training window is not configured (training.reactivationWindowHours). The Telecaller will be reactivated but stays gated until the Admin sets it.</span>
        ) : (
          <>A new window of {windowHours} hours will start now.</>
        )}
      </p>
      <div className="grid gap-2">
        <Label htmlFor="reason">Reason (recorded)</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. was on leave during the window" />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={go} disabled={busy || reason.trim().length < 3}>
          {busy ? 'Reactivating…' : 'Confirm reactivation'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
