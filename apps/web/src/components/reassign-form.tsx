'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Info, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, Field, IconTile, selectClass } from '@/components/ui/kit';
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
        <ArrowRightLeft aria-hidden="true" />
        Reassign
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`reassign-title-${recordId}`}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-foreground shadow-xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-[2px]"
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
          <div className="flex items-start gap-3">
            <IconTile icon={ArrowRightLeft} tone="violet" />
            <div className="min-w-0">
              <h2
                id={`reassign-title-${recordId}`}
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                Reassign calling record
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose an eligible telecaller and provide a reason. This change is logged.
              </p>
            </div>
          </div>
          {!targets.length ? (
            <Callout tone="warning" icon={Info}>
              No other eligible telecaller is available. Review team eligibility before reassigning.
            </Callout>
          ) : null}
          <Field label="New telecaller" htmlFor={`reassign-to-${recordId}`}>
            <select
              id={`reassign-to-${recordId}`}
              required
              disabled={busy || !targets.length}
              className={selectClass}
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
          </Field>
          <Field label="Reason (required)" htmlFor={`reassign-reason-${recordId}`}>
            <Input
              id={`reassign-reason-${recordId}`}
              required
              minLength={3}
              disabled={busy}
              placeholder="Why is this record being reassigned?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {msg ? (
            <Callout tone="danger" icon={TriangleAlert} role="alert">
              {msg}
            </Callout>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
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
