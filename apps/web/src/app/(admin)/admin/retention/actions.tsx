'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiClientError ? e.message : 'Request failed.' });
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

/** F-904: run one category. The API refuses (CONFIG_MISSING) until KBS sets the duration and enables execution. */
export function RunRetention({ category, label, runnable }: { category: string; label: string; runnable: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, msg, run } = useAction();
  if (!open)
    return (
      <Button size="sm" variant="outline" disabled={!runnable} onClick={() => setOpen(true)} title={runnable ? undefined : 'Blocked until KBS sets the retention duration and enables execution'}>
        Run
      </Button>
    );
  return (
    <div className="grid min-w-56 gap-1">
      <Input aria-label={`Policy reference for ${label}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Policy / approval reference" />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy || reason.trim().length < 10}
          onClick={() =>
            run(async () => {
              const { data: r } = await clientApi.post<{ processed: number; failed: number }>('/retention/execute', { category, reason: reason.trim() });
              return `${r.processed} processed${r.failed ? `, ${r.failed} failed (will retry)` : ''}.`;
            })
          }
        >
          Confirm run
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {msg ? <span className={msg.ok ? 'text-success text-xs' : 'text-destructive text-xs'}>{msg.text}</span> : null}
    </div>
  );
}

/** Place or release a legal hold on a file or calling record by id. */
export function LegalHoldForm() {
  const [subject, setSubject] = useState<'FILE' | 'CALLING_RECORD'>('FILE');
  const [id, setId] = useState('');
  const [reason, setReason] = useState('');
  const { busy, msg, run } = useAction();
  const submit = (hold: boolean) =>
    run(async () => {
      await clientApi.post('/retention/legal-holds', { subject, id: id.trim(), hold, reason: reason.trim() });
      return hold ? 'Legal hold placed.' : 'Legal hold released.';
    });
  const valid = /^[0-9a-f-]{36}$/i.test(id.trim()) && reason.trim().length >= 5;
  return (
    <div className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr_auto_auto] sm:items-center">
      <select aria-label="Subject" className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value as 'FILE' | 'CALLING_RECORD')}>
        <option value="FILE">File</option>
        <option value="CALLING_RECORD">Calling record</option>
      </select>
      <Input aria-label="Record id" value={id} onChange={(e) => setId(e.target.value)} placeholder="Id (UUID)" className="font-mono text-xs" />
      <Input aria-label="Hold reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
      <Button size="sm" disabled={busy || !valid} onClick={() => submit(true)}>
        Place hold
      </Button>
      <Button size="sm" variant="outline" disabled={busy || !valid} onClick={() => submit(false)}>
        Release
      </Button>
      {msg ? <span className={`sm:col-span-5 text-xs ${msg.ok ? 'text-success' : 'text-destructive'}`}>{msg.text}</span> : null}
    </div>
  );
}
