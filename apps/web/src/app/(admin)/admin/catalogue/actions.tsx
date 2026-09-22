'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

export function BankActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant={active ? 'outline' : 'secondary'}
      onClick={async () => {
        await clientApi.patch(`/catalogue/banks/${id}`, { active: !active });
        router.refresh();
      }}
    >
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
    <Card>
      <CardHeader>
        <CardTitle>New card / new bank</CardTitle>
        <CardDescription>Cards start as DRAFT; fill details on the card page, then publish.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Label htmlFor="card-bank">Bank</Label>
        <select id="card-bank" className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={bankId} onChange={(e) => setBankId(e.target.value)}>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <Label htmlFor="card-name">Card name</Label>
        <Input id="card-name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
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
          Create draft card
        </Button>
        <div className="mt-2 grid gap-2 border-t pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="bank-code">Bank code</Label>
              <Input id="bank-code" placeholder="KOTAK" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="bank-name">Display name</Label>
              <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
          </div>
          <Button
            variant="outline"
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
            Add bank
          </Button>
        </div>
        {msg ? <p className="text-sm">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
