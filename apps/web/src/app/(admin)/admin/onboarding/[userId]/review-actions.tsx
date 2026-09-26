'use client';

import { ApiClientError } from '@kbs/shared';
import { Check, Eye, FileImage, FileWarning, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, Field } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

/**
 * Onboarding review controls. `part` lets the page place the logged evidence buttons (reveal / cheque) next to the bank
 * details and the decision in its own card; omitted, both render together.
 */
export function ReviewActions({
  userId,
  chequeFileId,
  chequeName,
  canDecide,
  part,
}: {
  userId: string;
  chequeFileId: string | null;
  chequeName: string | null;
  canDecide: boolean;
  part?: 'evidence' | 'decision';
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const fail = (e: unknown, fb: string) => setMsg(e instanceof ApiClientError ? e.message : fb);
  return (
    <div className="grid gap-3">
      {part !== 'decision' ? (
        <div className="flex flex-wrap items-center gap-2">
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
            <Eye />
            Reveal account number (logged)
          </Button>
          {revealed ? <span className="rounded-md bg-amber-50 px-2 py-1 font-mono text-sm text-amber-950 ring-1 ring-amber-200 ring-inset">{revealed}</span> : null}
          {chequeFileId ? (
            <Button
              size="sm"
              variant="outline"
              className="max-w-full"
              onClick={async () => {
                try {
                  const r = await clientApi.get<{ url: string }>(`/files/${chequeFileId}/url`);
                  window.open(r.data.url, '_blank', 'noopener');
                } catch (e) {
                  fail(e, 'Could not open the cheque.');
                }
              }}
            >
              <FileImage />
              <span className="truncate">View cheque (logged) · {chequeName}</span>
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
              <FileWarning className="size-3.5" aria-hidden="true" />
              No cheque uploaded
            </span>
          )}
        </div>
      ) : null}
      {canDecide && part !== 'evidence' ? (
        <div className="grid gap-3">
          <Field label="Reason" htmlFor="review-reason" hint="Required to request changes; optional to approve. At least 3 characters when given.">
            <Input id="review-reason" placeholder="reason (required to reject)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              // the API accepts no reason or one of at least 3 characters (OnboardingReviewBody)
              disabled={reason.trim().length > 0 && reason.trim().length < 3}
              onClick={async () => {
                try {
                  await clientApi.post(`/onboarding/review/${userId}`, { decision: 'APPROVE', reason: reason.trim() || undefined });
                  setMsg('Approved — Advisor is now active.');
                  router.refresh();
                } catch (e) {
                  fail(e, 'Could not approve.');
                }
              }}
            >
              <Check />
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
              <Undo2 />
              Request changes
            </Button>
          </div>
        </div>
      ) : null}
      {msg ? (
        <Callout tone="neutral" role="status">
          {msg}
        </Callout>
      ) : null}
    </div>
  );
}
