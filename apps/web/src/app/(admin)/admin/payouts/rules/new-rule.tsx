'use client';

import { ApiClientError, digitsOnly, PAYOUT_TRIGGER_FIELDS } from '@kbs/shared';
import { FilePlus2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard, selectClass } from '@/components/ui/kit';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';


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
  useEffect(() => {
    if (!bankId) return;
    const t = setTimeout(() => void loadSeen(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first load only; bank/field changes reload explicitly
  }, []);
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
    <SectionCard icon={FilePlus2} tone="teal" title="New rule (draft)" description="Pick the exact bank values that trigger a payout. “V + ACTIVE” and “TXN ACTIVE - Rs 100” are separate values — include each deliberately." bodyClassName="grid gap-4 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pr-bank">Bank</Label>
          <select id="pr-bank" className={selectClass} value={bankId} onChange={(e) => { setBankId(e.target.value); setValues([]); void loadSeen(e.target.value, field); }}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-name">Rule name</Label>
          <Input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Card activation commission" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-field">Trigger field</Label>
          <select id="pr-field" className={selectClass} value={field} onChange={(e) => { setField(e.target.value); setValues([]); void loadSeen(bankId, e.target.value); }}>
            {PAYOUT_TRIGGER_FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 md:col-span-3">
          <Label>Trigger values (exact bank text)</Label>
          <div className="flex flex-wrap gap-1.5">
            {(seen ?? []).map((v) => (
              <button key={v} type="button" onClick={() => toggle(v)} aria-pressed={values.includes(v)}>
                <Badge variant={values.includes(v) ? 'success' : 'outline'} className="cursor-pointer">
                  {v}
                </Badge>
              </button>
            ))}
            {seen && seen.length === 0 ? <span className="text-muted-foreground text-xs">No values seen in MIS yet for this field — type one below exactly as the bank writes it.</span> : null}
          </div>
          <div className="flex max-w-xl gap-2">
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a value verbatim" />
            <Button type="button" variant="outline" disabled={!custom.trim()} onClick={() => { toggle(custom.trim()); setCustom(''); }}>
              <Plus />
              Add
            </Button>
          </div>
          {values.length ? <p className="text-xs text-slate-700">Selected: {values.map((v) => `“${v}”`).join(', ')}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-hold">Hold days</Label>
          <Input id="pr-hold" inputMode="numeric" min={0} max={365} value={holdDays} onChange={(e) => setHoldDays(Number(digitsOnly(e.target.value, 3)))} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-from">Effective from</Label>
          <Input id="pr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-pattern">Product code pattern (optional regex)</Label>
          <Input id="pr-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="e.g. ^MILL" />
        </div>
        <div className="grid gap-1.5 md:col-span-3">
          <Label htmlFor="pr-notes">Notes</Label>
          <Input id="pr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Source document / commission sheet reference" />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 md:col-span-3">
          <Button disabled={busy || !bankId || name.trim().length < 3 || values.length === 0} onClick={() => void submit()}>
            Create draft rule
          </Button>
          {msg ? <span className="text-destructive text-sm">{msg}</span> : null}
        </div>
    </SectionCard>
  );
}
