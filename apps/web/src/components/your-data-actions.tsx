'use client';

import { ApiClientError, DATA_REQUEST_TARGET_DAYS, DATA_REQUEST_TYPE_LABEL, DATA_REQUEST_TYPES, DataRequestCreateBody, type DataRequestType, type DataRequestView, type PersonalDataExport } from '@kbs/shared';
import { Download, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout, Field, selectClass } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

const HINT: Record<DataRequestType, string> = {
  ACCESS: 'KBS staff send a written summary of your data, how it is used and who it is shared with.',
  CORRECTION: 'Say what is wrong and what it should be.',
  ERASURE: 'Staff close your account and delete what the law allows. Payout, tax and audit records are kept as the law requires. This cannot be undone once carried out.',
  GRIEVANCE: 'Tell the Grievance Officer what went wrong with how KBS handles your data.',
};

/** Download (JSON file) and the request form for the "Your data" panel. */
export function YourDataActions({ activeTypes }: { activeTypes: DataRequestType[] }) {
  const router = useRouter();
  const [type, setType] = useState<DataRequestType>('CORRECTION');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState<'export' | 'send' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pending = activeTypes.includes(type);

  const download = async () => {
    setBusy('export');
    setMsg(null);
    try {
      const x = (await clientApi.get<PersonalDataExport>('/privacy/me/export')).data;
      const url = URL.createObjectURL(new Blob([JSON.stringify(x, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `kbs-my-data-${x.generatedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ tone: 'success', text: 'Downloaded. PAN and bank numbers show the last 4 digits only.' });
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof ApiClientError ? e.message : 'Could not prepare the download. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    const parsed = DataRequestCreateBody.safeParse({ type, details: details.trim() || undefined });
    if (!parsed.success) return setMsg({ tone: 'danger', text: parsed.error.issues[0]?.message ?? 'Check the details.' });
    // deletion is asked twice: the first press shows what happens, the second sends
    if (type === 'ERASURE' && !confirming) return setConfirming(true);
    setConfirming(false);
    setBusy('send');
    setMsg(null);
    try {
      const r = await clientApi.post<DataRequestView>('/privacy/requests', parsed.data);
      setDetails('');
      setMsg({ tone: 'success', text: `Request ${r.data.publicRef} sent. KBS aims to reply within ${DATA_REQUEST_TARGET_DAYS} days.` });
      router.refresh();
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof ApiClientError ? e.message : 'Could not send. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void download()} disabled={busy !== null}>
          <Download />
          {busy === 'export' ? 'Preparing…' : 'Download my data'}
        </Button>
        <span className="text-xs text-muted-foreground">A JSON file of your profile, payee details, leads by reference, payouts and sign-ins.</span>
      </div>
      <div className="grid gap-3 border-t border-border-subtle pt-4">
        <Field label="Ask KBS to" htmlFor="data-request-type" hint={pending ? 'You already have an open request of this kind; KBS will reply to it first.' : HINT[type]}>
          <select id="data-request-type" className={selectClass} value={type} onChange={(e) => {
              setType(e.target.value as DataRequestType);
              setConfirming(false);
            }}>
            {DATA_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {DATA_REQUEST_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={type === 'CORRECTION' || type === 'GRIEVANCE' ? 'Details' : 'Details (optional)'} htmlFor="data-request-details">
          <textarea
            id="data-request-details"
            className="min-h-24 w-full rounded-lg border border-border bg-card p-3 text-sm outline-none hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            value={details}
            maxLength={2000}
            onChange={(e) => setDetails(e.target.value)}
          />
        </Field>
        {confirming ? (
          <Callout tone="warning" role="alert" title="Ask KBS to delete your account?">
            Staff will contact you before anything is closed. Payout, tax and audit records stay as the law requires.
          </Callout>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant={type === 'ERASURE' ? 'destructive' : 'outline'} onClick={() => void send()} disabled={busy !== null || pending}>
            <Send />
            {busy === 'send' ? 'Sending…' : confirming ? 'Yes, ask to delete my account' : 'Send request'}
          </Button>
          {confirming ? (
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep my account
            </Button>
          ) : null}
        </div>
      </div>
      {msg ? (
        <Callout tone={msg.tone} role={msg.tone === 'danger' ? 'alert' : 'status'}>
          {msg.text}
        </Callout>
      ) : null}
    </div>
  );
}
