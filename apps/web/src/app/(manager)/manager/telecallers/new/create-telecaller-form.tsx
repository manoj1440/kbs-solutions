'use client';

import { ApiClientError, CreateTelecallerBody, mobileInput } from '@kbs/shared';
import { CircleCheck, GraduationCap, IdCard, TriangleAlert, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, Callout, Field, KeyValueGrid, SectionCard } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

interface Created {
  id: string;
  fullName: string;
  employeeCode: string;
  mobileMasked: string;
}

export function CreateTelecallerForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const canSubmit = CreateTelecallerBody.safeParse({ fullName, mobile }).success;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = CreateTelecallerBody.safeParse({ fullName, mobile });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      return;
    }
    setBusy(true);
    try {
      const r = await clientApi.post<Created>('/telecallers', parsed.data);
      setCreated(r.data);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create the Telecaller.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <SectionCard icon={CircleCheck} tone="emerald" title={`${created.fullName} was created.`} description="The Telecaller now reports to you.">
        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <Avatar name={created.fullName} />
            <KeyValueGrid
              className="flex-1"
              items={[
                ['Employee code', <span key="c" className="font-mono">{created.employeeCode}</span>],
                ['Mobile', <span key="m" className="font-mono">{created.mobileMasked}</span>],
              ]}
            />
          </div>
          <Callout tone="info" icon={GraduationCap}>
            Ask them to sign in to the KBS app with this mobile number. Their 72-hour training window starts at that first login.
          </Callout>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push('/manager')}>Back to team</Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null);
                setFullName('');
                setMobile('');
              }}
            >
              <UserPlus />
              Create another
            </Button>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={IdCard} tone="violet" title="Telecaller details" description="Both fields are required.">
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName">
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus required />
          </Field>
          <Field label="Mobile number" htmlFor="mobile">
            <Input id="mobile" inputMode="tel" placeholder="98765 43210" value={mobile} onChange={(e) => setMobile(mobileInput(e.target.value))} required />
          </Field>
        </div>
        <Callout tone="neutral" icon={GraduationCap}>
          The Telecaller signs in to the KBS app with this mobile number. Their 72-hour training window starts at that first login.
        </Callout>
        {error ? (
          <Callout role="alert" tone="danger" icon={TriangleAlert}>
            {error}
          </Callout>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" disabled={busy || !canSubmit}>
            <UserPlus />
            {busy ? 'Creating…' : 'Create Telecaller'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/manager')}>
            Cancel
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
