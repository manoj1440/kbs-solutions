'use client';

import { ApiClientError, type PayoutRuleView } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

/** F-601: approve / retire the rule, edit trigger values (new version when approved), add + approve rates — every approval carries a reason. */
export function RuleActions({ rule }: { rule: PayoutRuleView }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [values, setValues] = useState(rule.triggerValues.join(' | '));
  const [holdDays, setHoldDays] = useState(rule.holdDays);
  const [amount, setAmount] = useState('');
  const [rateFrom, setRateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string, navigateTo?: (r: unknown) => string | undefined) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(ok);
      const to = navigateTo?.(r);
      if (to) router.push(to);
      else router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  const draftRates = rule.rates.filter((x) => x.status === 'DRAFT');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Approvals need a reason and are audited. Editing an approved rule creates a new draft version.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ra-reason">Reason (for approvals / retirement)</Label>
          <Input id="ra-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. signed commission sheet Sep-2026" />
          <div className="flex flex-wrap gap-2">
            {rule.status === 'DRAFT' ? (
              <Button disabled={busy || reason.trim().length < 3 || !rule.rates.some((x) => x.status === 'APPROVED')} onClick={() => void run(() => clientApi.post(`/payouts/rules/${rule.id}/approve`, { reason }), 'Rule approved.')}>
                Approve rule
              </Button>
            ) : null}
            {rule.status === 'DRAFT' && !rule.rates.some((x) => x.status === 'APPROVED') ? <span className="text-muted-foreground self-center text-xs">Approve a rate first.</span> : null}
            {rule.status !== 'RETIRED' ? (
              <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void run(() => clientApi.post(`/payouts/rules/${rule.id}/retire`, { reason }), 'Rule retired.')}>
                Retire
              </Button>
            ) : null}
            {draftRates.map((x) => (
              <Button key={x.id} variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => void run(() => clientApi.post(`/payouts/rates/${x.id}/approve`, { reason }), 'Rate approved.')}>
                Approve rate ₹{x.amountInr.toLocaleString('en-IN')}
              </Button>
            ))}
          </div>
        </div>
        {rule.status !== 'RETIRED' ? (
          <div className="grid gap-2">
            <Label htmlFor="ra-values">Trigger values (separate with |)</Label>
            <Input id="ra-values" value={values} onChange={(e) => setValues(e.target.value)} />
            <Label htmlFor="ra-hold">Hold days</Label>
            <Input id="ra-hold" type="number" min={0} value={holdDays} onChange={(e) => setHoldDays(Number(e.target.value))} />
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  () => clientApi.patch<{ id: string }>(`/payouts/rules/${rule.id}`, { triggerValues: values.split('|').map((v) => v.trim()).filter(Boolean), holdDays }),
                  rule.status === 'APPROVED' ? 'New draft version created.' : 'Draft updated.',
                  (r) => ((r as { data: { id: string } }).data.id !== rule.id ? `/admin/payouts/rules/${(r as { data: { id: string } }).data.id}` : undefined),
                )
              }
            >
              {rule.status === 'APPROVED' ? 'Save as new version' : 'Save draft'}
            </Button>
            <Label htmlFor="ra-amount">New rate (₹)</Label>
            <div className="flex gap-2">
              <Input id="ra-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500" />
              <Input type="date" value={rateFrom} onChange={(e) => setRateFrom(e.target.value)} aria-label="rate effective from" />
              <Button variant="outline" disabled={busy || !amount} onClick={() => void run(() => clientApi.post(`/payouts/rules/${rule.id}/rates`, { amountInr: Number(amount), effectiveFrom: new Date(`${rateFrom}T00:00:00+05:30`).toISOString() }), 'Draft rate added.').then(() => setAmount(''))}>
                Add rate
              </Button>
            </div>
          </div>
        ) : null}
        {msg ? (
          <p role="status" className="text-sm md:col-span-2">
            {msg}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
