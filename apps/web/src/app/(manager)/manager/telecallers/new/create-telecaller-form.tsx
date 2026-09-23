'use client';

import { ApiClientError, CreateTelecallerBody, mobileInput } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      <Card>
        <CardContent className="grid gap-3">
          <p className="font-medium">{created.fullName} was created.</p>
          <p className="text-sm">
            Employee code <span className="font-mono">{created.employeeCode}</span> · {created.mobileMasked}
          </p>
          <p className="text-muted-foreground text-sm">Ask them to sign in to the KBS app with this mobile number. Their 72-hour training window starts at that first login.</p>
          <div className="flex gap-2">
            <Button onClick={() => router.push('/manager')}>Back to team</Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null);
                setFullName('');
                setMobile('');
              }}
            >
              Create another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mobile">Mobile number</Label>
        <Input id="mobile" inputMode="tel" placeholder="98765 43210" value={mobile} onChange={(e) => setMobile(mobileInput(e.target.value))} required />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !canSubmit}>
          {busy ? 'Creating…' : 'Create Telecaller'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/manager')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
