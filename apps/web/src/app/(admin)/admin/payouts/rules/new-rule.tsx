'use client';

import { ApiClientError, PAYOUT_TRIGGER_FIELDS } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

const sel = 'border-input bg-background h-9 w-full rounded-md border px-2 text-sm';

/** F-601: create a DRAFT rule. The trigger picker shows the distinct values the bank has actually reported (knownValues + snapshots). */
export function NewRule({ banks }: { banks: { id: string; code: string; displayName: string }[] }) {
  const router = useRouter();
  const [bankId, setBankId] = useState(banks[0]?.id ?? '');
  const [name, setName] = useState('');
  const [field, setField] = useState('cardActivationStatus');
  const [seen, setSeen] = useState<string[] | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [holdDays, setHoldDays] = useState(0);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [pattern, setPattern] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadSeen = async (b = bankId, f = field) => {
    try {
      setSeen((await clientApi.get<{ values: string[] }>(`/payouts/rules/seen-values?bankId=${b}&field=${f}`)).data.values);
    } catch {
      setSeen([]);
    }
  };
  if (seen === null && bankId) setTimeout(() => void loadSeen(), 0);
  const toggle = (v: string) => setValues((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await clientApi.post<{ id: string }>('/payouts/rules', { bankId, name, triggerField: field, triggerValues: values, holdDays, effectiveFrom: new Date(`${from}T00:00:00+05:30`).toISOString(), ...(pattern ? { productCodePattern: pattern } : {}), ...(notes ? { notes } : {}) });
      router.push(`/admin/payouts/rules/${r.data.id}`);
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Could not create the rule.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>New rule (draft)</CardTitle>
        <CardDescription>Pick the exact bank values that trigger a payout. “V + ACTIVE” and “TXN ACTIVE - Rs 100” are separate values — include each deliberately.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor="pr-bank">Bank</Label>
          <select id="pr-bank" className={sel} value={bankId} onChange={(e) => { setBankId(e.target.value); setValues([]); void loadSeen(e.target.value, field); }}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pr-name">Rule name</Label>
          <Input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Card activation commission" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pr-field">Trigger field</Label>
          <select id="pr-field" className={sel} value={field} onChange={(e) => { setField(e.target.value); setValues([]); void loadSeen(bankId, e.target.value); }}>
            {PAYOUT_TRIGGER_FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1 md:col-span-3">
          <Label>Trigger values (exact bank text)</Label>
          <div className="flex flex-wrap gap-1">
            {(seen ?? []).map((v) => (
              <button key={v} type="button" onClick={() => toggle(v)} aria-pressed={values.includes(v)}>
                <Badge variant={values.includes(v) ? 'success' : 'outline'}>{v}</Badge>
              </button>
            ))}
            {seen && seen.length === 0 ? <span className="text-muted-foreground text-xs">No values seen in MIS yet for this field — type one below exactly as the bank writes it.</span> : null}
          </div>
          <div className="flex gap-2">
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a value verbatim" />
            <Button type="button" variant="outline" disabled={!custom.trim()} onClick={() => { toggle(custom.trim()); setCustom(''); }}>
              Add
            </Button>
          </div>
          {values.length ? <p className="text-xs">Selected: {values.map((v) => `“${v}”`).join(', ')}</p> : null}
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pr-hold">Hold days</Label>
          <Input id="pr-hold" type="number" min={0} max={365} value={holdDays} onChange={(e) => setHoldDays(Number(e.target.value))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pr-from">Effective from</Label>
          <Input id="pr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pr-pattern">Product code pattern (optional regex)</Label>
          <Input id="pr-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="e.g. ^MILL" />
        </div>
        <div className="grid gap-1 md:col-span-3">
          <Label htmlFor="pr-notes">Notes</Label>
          <Input id="pr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Source document / commission sheet reference" />
        </div>
        <div className="md:col-span-3">
          <Button disabled={busy || !bankId || name.trim().length < 3 || values.length === 0} onClick={() => void submit()}>
            Create draft rule
          </Button>
          {msg ? <span className="text-destructive ml-3 text-sm">{msg}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
