'use client';

import { ApiClientError, isValidE164India, mobileInput } from '@kbs/shared';
import { Ban, CircleAlert, CircleCheck, MapPin, PhoneOff, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, Field, SectionCard } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

export function ComplianceActions() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [suppressing, setSuppressing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const say = (m: string) => {
    setMsg({ ok: true, text: m });
    router.refresh();
  };
  const fail = (e: unknown, fallback: string) =>
    setMsg({ ok: false, text: e instanceof ApiClientError ? e.message : fallback });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard
        icon={Ban}
        tone="rose"
        title="Suppress a mobile"
        description="Customer request or compliance decision."
      >
        <div className="grid gap-3">
          <Field label="Mobile" htmlFor="sup-mobile">
            <Input
              id="sup-mobile"
              inputMode="tel"
              value={mobile}
              onChange={(e) => setMobile(mobileInput(e.target.value))}
              placeholder="98765 43210"
            />
          </Field>
          <Button
            className="justify-self-start"
            disabled={suppressing || !isValidE164India(mobile)}
            onClick={async () => {
              setSuppressing(true);
              try {
                await clientApi.post('/suppressions', { mobile, reason: 'COMPLIANCE' });
                setMobile('');
                say('Mobile suppressed.');
              } catch (e) {
                fail(e, 'Could not suppress.');
              } finally {
                setSuppressing(false);
              }
            }}
          >
            <Ban />
            {suppressing ? 'Suppressing…' : 'Suppress'}
          </Button>
        </div>
      </SectionCard>
      <SectionCard
        icon={PhoneOff}
        tone="amber"
        title="Import DND list"
        description="CSV/XLSX with a mobile column. Every number is suppressed."
      >
        <FileUploadButton
          purpose="dnd_list"
          accept=".csv,.xlsx"
          label="Upload DND list"
          onUploaded={async (f) => {
            try {
              const r = await clientApi.post<{ added: number; invalid: number }>(
                '/suppressions/import',
                { fileId: f.id },
              );
              say(`DND import: ${r.data.added} added, ${r.data.invalid} invalid.`);
            } catch (e) {
              fail(e, 'Import failed.');
            }
          }}
        />
      </SectionCard>
      <SectionCard
        icon={MapPin}
        tone="sky"
        title="Pincode master"
        description="India Post directory (Pincode, OfficeName, District, StateName) for city/state resolution."
      >
        <FileUploadButton
          purpose="pincode_master"
          accept=".csv,.xlsx"
          label="Upload pincode CSV"
          onUploaded={async (f) => {
            try {
              const r = await clientApi.post<{ upserted: number; invalid: number }>(
                '/pincodes/import',
                { fileId: f.id },
              );
              say(`Pincode master: ${r.data.upserted} rows upserted, ${r.data.invalid} invalid.`);
            } catch (e) {
              fail(e, 'Import failed.');
            }
          }}
        />
      </SectionCard>
      {msg ? (
        <Callout
          role={msg.ok ? 'status' : 'alert'}
          tone={msg.ok ? 'success' : 'danger'}
          icon={msg.ok ? CircleCheck : CircleAlert}
          className="lg:col-span-3"
        >
          {msg.text}
        </Callout>
      ) : null}
    </div>
  );
}

/** F-908 P5: inline reason (recorded in the audit log) instead of window.prompt; failures show, not vanish. */
export function LiftButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Undo2 />
        Lift
      </Button>
    );
  return (
    <div className="grid min-w-56 gap-1.5">
      <Input
        aria-label="Reason for lifting the suppression"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (recorded)"
        autoFocus
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={busy || reason.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await clientApi.post(`/suppressions/${id}/lift`, { reason: reason.trim() });
              setOpen(false);
              setReason('');
              router.refresh();
            } catch (e) {
              setErr(e instanceof ApiClientError ? e.message : 'Could not lift the suppression. Try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Lifting…' : 'Lift suppression'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
        >
          Cancel
        </Button>
      </div>
      {err ? (
        <Callout role="alert" tone="danger" icon={CircleAlert}>
          {err}
        </Callout>
      ) : null}
    </div>
  );
}
