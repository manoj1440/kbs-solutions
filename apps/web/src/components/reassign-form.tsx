'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

/** F-305 §4: manual reassignment with mandatory reason (Manager within team, Admin any). */
export function ReassignForm({
  recordId,
  currentId,
  options,
}: {
  recordId: string;
  currentId: string | null;
  options: { id: string; label: string }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targets = options.filter((o) => o.id !== currentId);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setMsg(null);
          dialog.current?.showModal();
        }}
      >
        Reassign
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`reassign-title-${recordId}`}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border bg-white p-6 text-foreground shadow-xl backdrop:bg-slate-950/40"
      >
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !to || reason.trim().length < 3) return;
            setBusy(true);
            setMsg(null);
            try {
              await clientApi.post(`/calling/records/${recordId}/reassign`, {
                toTelecallerUserId: to,
                reason,
              });
              dialog.current?.close();
              setTo('');
              setReason('');
              router.refresh();
            } catch (e) {
              setMsg(e instanceof ApiClientError ? e.message : 'Could not reassign.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <h2 id={`reassign-title-${recordId}`} className="text-lg font-semibold">
              Reassign calling record
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose an eligible telecaller and provide a reason. This change is logged.
            </p>
          </div>
          {!targets.length ? (
            <p className="rounded-lg bg-muted p-3 text-sm">
              No other eligible telecaller is available. Review team eligibility before reassigning.
            </p>
          ) : null}
          <div className="grid gap-2">
            <label htmlFor={`reassign-to-${recordId}`} className="text-sm font-medium">
              New telecaller
            </label>
            <select
              id={`reassign-to-${recordId}`}
              required
              disabled={busy || !targets.length}
              className="border-input bg-background h-10 w-full min-w-0 rounded-md border px-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              <option value="">Select a telecaller</option>
              {targets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor={`reassign-reason-${recordId}`} className="text-sm font-medium">
              Reason (required)
            </label>
            <Input
              id={`reassign-reason-${recordId}`}
              required
              minLength={3}
              disabled={busy}
              placeholder="Why is this record being reassigned?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {msg ? (
            <p role="alert" className="text-destructive text-sm">
              {msg}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !to || reason.trim().length < 3}>
              {busy ? 'Moving…' : 'Move record'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
