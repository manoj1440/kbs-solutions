'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

export function ReviewActions({ userId, chequeFileId, chequeName, canDecide }: { userId: string; chequeFileId: string | null; chequeName: string | null; canDecide: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const fail = (e: unknown, fb: string) => setMsg(e instanceof ApiClientError ? e.message : fb);
  return (
    <div className="grid gap-2 pt-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              const r = await clientApi.get<{ bankAccountNumber: string | null }>(`/onboarding/review/${userId}?reveal=bank`);
              setRevealed(r.data.bankAccountNumber);
            } catch (e) {
              fail(e, 'Could not reveal.');
            }
          }}
        >
          Reveal account number (logged)
        </Button>
        {revealed ? <span className="self-center font-mono text-sm">{revealed}</span> : null}
        {chequeFileId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const r = await clientApi.get<{ url: string }>(`/files/${chequeFileId}/url`);
                window.open(r.data.url, '_blank', 'noopener');
              } catch (e) {
                fail(e, 'Could not open the cheque.');
              }
            }}
          >
            View cheque (logged) · {chequeName}
          </Button>
        ) : (
          <span className="text-destructive self-center text-xs">No cheque uploaded</span>
        )}
      </div>
      {canDecide ? (
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <Input id="review-reason" placeholder="reason (required to reject)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button
            onClick={async () => {
              try {
                await clientApi.post(`/onboarding/review/${userId}`, { decision: 'APPROVE', reason: reason || undefined });
                setMsg('Approved — Advisor is now active.');
                router.refresh();
              } catch (e) {
                fail(e, 'Could not approve.');
              }
            }}
          >
            Approve
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3}
            onClick={async () => {
              try {
                await clientApi.post(`/onboarding/review/${userId}`, { decision: 'REJECT', reason });
                setMsg('Sent back to the Advisor with your reason.');
                router.refresh();
              } catch (e) {
                fail(e, 'Could not reject.');
              }
            }}
          >
            Request changes
          </Button>
        </div>
      ) : null}
      {msg ? (
        <p role="status" className="text-sm">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
