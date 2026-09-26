'use client';

import { ApiClientError } from '@kbs/shared';
import { Clock, RotateCcw, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, Field } from '@/components/ui/kit';
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

  if (!open)
    return (
      <Button onClick={() => setOpen(true)} className="w-full sm:w-fit">
        <RotateCcw />
        Reactivate training
      </Button>
    );
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      {windowHours === null ? (
        <Callout tone="warning" icon={TriangleAlert}>
          The new training window is not configured (training.reactivationWindowHours). The Telecaller will be reactivated but stays gated until the Admin sets it.
        </Callout>
      ) : (
        <Callout tone="info" icon={Clock}>
          A new window of {windowHours} hours will start now.
        </Callout>
      )}
      <Field label="Reason (recorded)" htmlFor="reason">
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. was on leave during the window" className="bg-white" />
      </Field>
      {error ? (
        <Callout role="alert" tone="danger" icon={TriangleAlert}>
          {error}
        </Callout>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={go} disabled={busy || reason.trim().length < 3}>
          <RotateCcw />
          {busy ? 'Reactivating…' : 'Confirm reactivation'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
