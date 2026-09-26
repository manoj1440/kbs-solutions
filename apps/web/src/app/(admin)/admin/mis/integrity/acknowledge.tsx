'use client';

import { ApiClientError } from '@kbs/shared';
import { Check, Info, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout, SectionCard } from '@/components/ui/kit';
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
    <SectionCard
      icon={Sparkles}
      tone="violet"
      title={`${bank.displayName} · new values pending acknowledgement`}
      description="Exactly as the bank wrote them. Acknowledging only stops them being flagged as new; display never changes."
    >
      <div className="grid gap-3">
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80">
          {pending.map((p) => (
            <li key={p.field} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="grid min-w-0 gap-1.5">
                <span className="font-mono text-xs font-semibold text-slate-700">{p.field}</span>
                <div className="flex flex-wrap gap-1.5">
                  {p.values.map((v) => (
                    <span key={v} className="rounded-md bg-violet-50 px-1.5 py-0.5 text-xs text-slate-800 ring-1 ring-violet-100">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="soft" disabled={busy || !profileId} onClick={() => void ack(p.field, p.values)}>
                <Check />
                Acknowledge
              </Button>
            </li>
          ))}
        </ul>
        {!profileId ? (
          <Callout tone="warning" icon={Info}>
            No approved profile for this bank — approve one under Bank MIS first.
          </Callout>
        ) : null}
        {msg ? (
          <p role="status" className="text-xs text-slate-600">
            {msg}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
