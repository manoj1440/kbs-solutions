'use client';

import { ApiClientError, DataRequestUpdateBody, type DataRequestStatus } from '@kbs/shared';
import { Check, Hand, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout, Field } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

const TEXTAREA =
  'min-h-24 w-full rounded-lg border border-border bg-card p-3 text-sm outline-none hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25';

/** F-908 Admin controls: take the request, keep a staff note, close it with a reply the user will read. */
export function RequestActions({ id, status, staffNote, handledByName }: { id: string; status: DataRequestStatus; staffNote: string | null; handledByName: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState(staffNote ?? '');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const send = async (body: Record<string, unknown>, done: string) => {
    const parsed = DataRequestUpdateBody.safeParse(body);
    if (!parsed.success) return setMsg({ tone: 'danger', text: parsed.error.issues[0]?.message ?? 'Check the form.' });
    setBusy(true);
    setMsg(null);
    try {
      await clientApi.patch(`/privacy/requests/${id}`, parsed.data);
      setMsg({ tone: 'success', text: done });
      router.refresh();
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof ApiClientError ? e.message : 'Could not save. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5">
      {status === 'OPEN' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={busy} onClick={() => void send({ status: 'IN_PROGRESS', assignToMe: true }, 'You are now handling this request.')}>
            <Hand />
            Take this request
          </Button>
          <span className="text-xs text-muted-foreground">Marks it in progress with you as the handler.</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">In progress{handledByName ? ` with ${handledByName}` : ''}.</p>
      )}

      <Field label="Staff note" htmlFor="staff-note" hint="Only KBS staff see this.">
        <textarea id="staff-note" className={TEXTAREA} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div>
        <Button variant="soft" size="sm" disabled={busy || note.trim() === (staffNote ?? '')} onClick={() => void send({ staffNote: note.trim() }, 'Note saved.')}>
          <Save />
          Save note
        </Button>
      </div>

      <Field label="Reply to the user" htmlFor="reply" hint="Required to close. Say what was done, or why it was declined. The user sees this in the app and on the web.">
        <textarea id="reply" className={TEXTAREA} value={reply} maxLength={2000} onChange={(e) => setReply(e.target.value)} />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button disabled={busy || reply.trim().length < 10} onClick={() => void send({ status: 'COMPLETED', resolutionNote: reply.trim() }, 'Request completed. The user can read your reply.')}>
          <Check />
          Mark completed
        </Button>
        <Button variant="destructive" disabled={busy || reply.trim().length < 10} onClick={() => void send({ status: 'REJECTED', resolutionNote: reply.trim() }, 'Request declined. The user can read your reason.')}>
          <X />
          Decline
        </Button>
      </div>
      {msg ? (
        <Callout tone={msg.tone} role={msg.tone === 'danger' ? 'alert' : 'status'}>
          {msg.text}
        </Callout>
      ) : null}
    </div>
  );
}
