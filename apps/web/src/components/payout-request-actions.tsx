'use client';

import { ApiClientError } from '@kbs/shared';
import { Ban, Check, Gavel, Lock, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { PayoutRequestDto } from '@/components/payout-request-detail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/kit';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

/** F-604: approve / reject (reason required) as the viewer's role; Admin cancel before payment. */
export function RequestActions({ request }: { request: PayoutRequestDto }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      setReason('');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  if (!request.me.canApprove && !request.me.canCancel) {
    return (
      <SectionCard
        icon={Lock}
        tone="slate"
        title="Your decision"
        description={request.state !== 'PENDING_APPROVALS' ? 'Approvals are closed for this request.' : request.me.role ? 'You have already recorded your decision, or the required earlier approval is outstanding.' : 'You are not an approver for this request.'}
      />
    );
  }
  return (
    <SectionCard icon={Gavel} tone="teal" title={`Your decision${request.me.role ? ` as ${request.me.role.toLowerCase()}` : ''}`} description="Every decision is recorded with actor, role, time and reason. A rejection releases the card events for a new request." bodyClassName="grid gap-2">
        <Label htmlFor="pr-reason">Reason (required to reject or cancel)</Label>
        <Input id="pr-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. verified evidence against HDFC MIS batch" />
        <div className="mt-1 flex flex-wrap gap-2">
          {request.me.canApprove ? (
            <>
              <Button disabled={busy} onClick={() => void run(() => clientApi.post(`/payouts/requests/${request.id}/approvals`, { decision: 'APPROVED', ...(reason.trim() ? { reason: reason.trim() } : {}) }), 'Approval recorded.')}>
                <Check />
                Approve
              </Button>
              <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void run(() => clientApi.post(`/payouts/requests/${request.id}/approvals`, { decision: 'REJECTED', reason: reason.trim() }), 'Rejected; card events released.')}>
                <X />
                Reject
              </Button>
            </>
          ) : null}
          {request.me.canCancel ? (
            <Button variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => void run(() => clientApi.post(`/payouts/requests/${request.id}/cancel`, { reason: reason.trim() }), 'Request cancelled; card events released.')}>
              <Ban />
              Cancel request
            </Button>
          ) : null}
        </div>
        {msg ? (
          <p role="status" className="text-sm text-slate-700">
            {msg}
          </p>
        ) : null}
    </SectionCard>
  );
}
