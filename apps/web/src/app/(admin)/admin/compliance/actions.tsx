'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

export function ComplianceActions() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const say = (m: string) => {
    setMsg(m);
    router.refresh();
  };
  const fail = (e: unknown, fallback: string) => setMsg(e instanceof ApiClientError ? e.message : fallback);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Suppress a mobile</CardTitle>
          <CardDescription>Customer request or compliance decision.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Label htmlFor="sup-mobile">Mobile</Label>
          <Input id="sup-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98765 43210" />
          <Button
            onClick={async () => {
              try {
                await clientApi.post('/suppressions', { mobile, reason: 'COMPLIANCE' });
                setMobile('');
                say('Mobile suppressed.');
              } catch (e) {
                fail(e, 'Could not suppress.');
              }
            }}
          >
            Suppress
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Import DND list</CardTitle>
          <CardDescription>CSV/XLSX with a mobile column. Every number is suppressed.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadButton
            purpose="dnd_list"
            accept=".csv,.xlsx"
            label="Upload DND list"
            onUploaded={async (f) => {
              try {
                const r = await clientApi.post<{ added: number; invalid: number }>('/suppressions/import', { fileId: f.id });
                say(`DND import: ${r.data.added} added, ${r.data.invalid} invalid.`);
              } catch (e) {
                fail(e, 'Import failed.');
              }
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pincode master</CardTitle>
          <CardDescription>India Post directory (Pincode, OfficeName, District, StateName) for city/state resolution.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadButton
            purpose="pincode_master"
            accept=".csv,.xlsx"
            label="Upload pincode CSV"
            onUploaded={async (f) => {
              try {
                const r = await clientApi.post<{ upserted: number; invalid: number }>('/pincodes/import', { fileId: f.id });
                say(`Pincode master: ${r.data.upserted} rows upserted, ${r.data.invalid} invalid.`);
              } catch (e) {
                fail(e, 'Import failed.');
              }
            }}
          />
        </CardContent>
      </Card>
      {msg ? (
        <p role="status" className="text-sm md:col-span-3">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

export function LiftButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        const reason = window.prompt('Reason for lifting the suppression (recorded):');
        if (!reason || reason.trim().length < 3) return;
        setBusy(true);
        try {
          await clientApi.post(`/suppressions/${id}/lift`, { reason });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      Lift
    </Button>
  );
}
