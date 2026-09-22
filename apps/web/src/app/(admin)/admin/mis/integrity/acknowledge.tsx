'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clientApi } from '@/lib/client-api';

/** F-507: acknowledge verbatim new bank values into the approved profile's knownValues (F-501). Values are never translated. */
export function AcknowledgeValues({ bank, profileId, pending }: { bank: { id: string; displayName: string }; profileId: string | null; pending: { field: string; values: string[] }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ack = async (field: string, values: string[]) => {
    if (!profileId) return;
    setBusy(true);
    try {
      await clientApi.post(`/mis/profiles/${profileId}/known-values`, { values: { [field]: values }, reason: `acknowledged from integrity dashboard (${bank.displayName})` });
      setMsg(`${values.length} value(s) acknowledged for ${field}.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Could not acknowledge.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{bank.displayName} · new values pending acknowledgement</CardTitle>
        <CardDescription>Exactly as the bank wrote them. Acknowledging only stops them being flagged as new; display never changes.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {pending.map((p) => (
          <div key={p.field} className="flex flex-wrap items-center gap-2">
            <strong>{p.field}</strong>
            <span>{p.values.join(' · ')}</span>
            <Button size="sm" variant="ghost" disabled={busy || !profileId} onClick={() => void ack(p.field, p.values)}>
              Acknowledge
            </Button>
          </div>
        ))}
        {!profileId ? <p className="text-muted-foreground text-xs">No approved profile for this bank — approve one under Bank MIS first.</p> : null}
        {msg ? (
          <p role="status" className="text-xs">
            {msg}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
