'use client';

import { ApiClientError } from '@kbs/shared';
import { Building2, CreditCard, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, Field, SectionCard, selectClass } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

export function BankActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant={active ? 'soft' : 'outline'}
      title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
      className="capitalize"
      onClick={async () => {
        await clientApi.patch(`/catalogue/banks/${id}`, { active: !active });
        router.refresh();
      }}
    >
      <span className={cn('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} aria-hidden="true" />
      {active ? 'active' : 'inactive'}
    </Button>
  );
}

export function NewCardForm({ banks }: { banks: { id: string; label: string }[] }) {
  const router = useRouter();
  const [bankId, setBankId] = useState(banks[0]?.id ?? '');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <SectionCard icon={Plus} tone="teal" title="New card / new bank" description="Cards start as DRAFT; fill details on the card page, then publish.">
      <div className="grid gap-5">
        <div className="grid gap-3">
          <p className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">
            <CreditCard className="size-3.5" aria-hidden="true" />
            Draft card
          </p>
          <Field label="Bank" htmlFor="card-bank">
            <select id="card-bank" className={selectClass} value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Card name" htmlFor="card-name" hint="At least 2 characters.">
            <Input id="card-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button
            className="w-full sm:w-fit"
            disabled={!bankId || name.trim().length < 2}
            onClick={async () => {
              try {
                const r = await clientApi.post<{ id: string }>('/catalogue/cards', { bankId, name });
                router.push(`/admin/catalogue/${r.data.id}`);
              } catch (e) {
                setMsg(e instanceof ApiClientError ? e.message : 'Could not create the card.');
              }
            }}
          >
            <Plus />
            Create draft card
          </Button>
        </div>
        <div className="grid gap-3 border-t border-slate-100 pt-5">
          <p className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">
            <Building2 className="size-3.5" aria-hidden="true" />
            Bank
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank code" htmlFor="bank-code">
              <Input id="bank-code" placeholder="KOTAK" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </Field>
            <Field label="Display name" htmlFor="bank-name">
              <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </Field>
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            disabled={code.length < 2 || bankName.length < 2}
            onClick={async () => {
              try {
                await clientApi.post('/catalogue/banks', { code, displayName: bankName });
                setCode('');
                setBankName('');
                setMsg('Bank added.');
                router.refresh();
              } catch (e) {
                setMsg(e instanceof ApiClientError ? e.message : 'Could not add the bank.');
              }
            }}
          >
            <Building2 />
            Add bank
          </Button>
        </div>
        {msg ? (
          <Callout tone="neutral" role="status">
            {msg}
          </Callout>
        ) : null}
      </div>
    </SectionCard>
  );
}
