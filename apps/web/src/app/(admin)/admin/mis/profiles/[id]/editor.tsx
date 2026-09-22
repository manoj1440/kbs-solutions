'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

export interface MisProfile {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
  sheetSelector: string | null;
  headerAliases: Record<string, string[]>;
  fieldMap: Record<string, string>;
  referenceFields: { kind: string; header: string }[];
  snapshotMode: 'DELTA' | 'FULL_SNAPSHOT';
  blankOverwrites: boolean;
  timezone: string;
  timezoneAssumed: boolean;
  dateFormats: string[] | null;
  knownValues: Record<string, string[]> | null;
  bank: { code: string; displayName: string };
  internalFields: { text: string[]; date: string[] };
}

/** F-501 §4 profile editor: internal field → exact raw header, references in order, semantics, known values. */
export function MisProfileEditor({ initial }: { initial: MisProfile }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>(initial.fieldMap);
  const [refs, setRefs] = useState(initial.referenceFields.map((r) => `${r.kind}=${r.header}`).join('\n'));
  const [aliases, setAliases] = useState(Object.entries(initial.headerAliases ?? {}).map(([k, v]) => `${k}=${v.join('|')}`).join('\n'));
  const [form, setForm] = useState({ name: initial.name, sheetSelector: initial.sheetSelector ?? '', snapshotMode: initial.snapshotMode, blankOverwrites: initial.blankOverwrites, timezone: initial.timezone, dateFormats: (initial.dateFormats ?? []).join('\n') });
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const readOnly = p.status === 'RETIRED';
  const fail = (e: unknown, fb: string) => setMsg(e instanceof ApiClientError ? e.message : fb);
  const save = async () => {
    setMsg(null);
    try {
      const referenceFields = refs.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [kind, ...h] = l.split('='); return { kind: kind.trim(), header: h.join('=').trim() }; });
      const headerAliases = Object.fromEntries(aliases.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [k, v] = l.split('='); return [k.trim(), (v ?? '').split('|').map((x) => x.trim()).filter(Boolean)]; }));
      const r = await clientApi.patch<MisProfile>(`/mis/profiles/${p.id}`, { name: form.name, sheetSelector: form.sheetSelector || null, fieldMap: Object.fromEntries(Object.entries(fieldMap).filter(([, v]) => v.trim())), referenceFields, headerAliases, snapshotMode: form.snapshotMode, blankOverwrites: form.blankOverwrites, timezone: form.timezone, dateFormats: form.dateFormats.split('\n').map((s) => s.trim()).filter(Boolean) });
      if (r.data.id !== p.id) {
        router.push(`/admin/mis/profiles/${r.data.id}`);
        return;
      }
      setP(r.data);
      setMsg('Saved.');
      router.refresh();
    } catch (e) {
      fail(e, 'Could not save.');
    }
  };
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {p.bank.displayName} — {p.name}
        </h1>
        <Badge variant={p.status === 'APPROVED' ? 'success' : p.status === 'DRAFT' ? 'warning' : 'unknown'}>
          {p.status} v{p.version}
        </Badge>
      </div>
      {msg ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          {msg}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Column mapping</CardTitle>
            <CardDescription>Internal field → header exactly as the bank writes it (misspellings included). Unmapped columns are still kept in raw.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            {[...p.internalFields.text, ...p.internalFields.date].map((f) => (
              <div key={f} className="grid grid-cols-[12rem_1fr] items-center gap-2">
                <Label htmlFor={`fm-${f}`} className="text-xs">
                  {f}
                  {p.internalFields.date.includes(f) ? ' (date)' : ''}
                </Label>
                <Input id={`fm-${f}`} disabled={readOnly} className="h-8 text-xs" value={fieldMap[f] ?? ''} onChange={(e) => setFieldMap({ ...fieldMap, [f]: e.target.value })} />
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identifiers & semantics</CardTitle>
              <CardDescription>References are matched exactly (bank + value) in this order. Nothing else is ever used to match.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Label htmlFor="pname">Name</Label>
              <Input id="pname" disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Label htmlFor="psheet">Sheet selector (blank = first)</Label>
              <Input id="psheet" disabled={readOnly} value={form.sheetSelector} onChange={(e) => setForm({ ...form, sheetSelector: e.target.value })} />
              <Label htmlFor="prefs">Reference fields (KIND=Header, one per line)</Label>
              <textarea id="prefs" disabled={readOnly} className="border-input bg-background min-h-16 rounded-md border p-2 font-mono text-xs" value={refs} onChange={(e) => setRefs(e.target.value)} />
              <Label htmlFor="palias">Header aliases (Header=alt1|alt2)</Label>
              <textarea id="palias" disabled={readOnly} className="border-input bg-background min-h-16 rounded-md border p-2 font-mono text-xs" value={aliases} onChange={(e) => setAliases(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="pmode">Snapshot mode</Label>
                  <select id="pmode" disabled={readOnly} className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={form.snapshotMode} onChange={(e) => setForm({ ...form, snapshotMode: e.target.value as 'DELTA' })}>
                    <option value="DELTA">DELTA (partial file)</option>
                    <option value="FULL_SNAPSHOT">FULL_SNAPSHOT (absence is meaningful)</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ptz">Timezone</Label>
                  <Input id="ptz" disabled={readOnly} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={readOnly} checked={form.blankOverwrites} onChange={(e) => setForm({ ...form, blankOverwrites: e.target.checked })} />
                Blank cells overwrite earlier values (default off: blank = &quot;Not reported&quot;)
              </label>
              <Label htmlFor="pdates">Date formats (one per line)</Label>
              <textarea id="pdates" disabled={readOnly} className="border-input bg-background min-h-16 rounded-md border p-2 font-mono text-xs" value={form.dateFormats} onChange={(e) => setForm({ ...form, dateFormats: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <Button disabled={readOnly} onClick={save}>
                  {p.status === 'APPROVED' ? 'Save as new version' : 'Save'}
                </Button>
                {p.status === 'DRAFT' ? (
                  <>
                    <Input id="approve-reason" className="max-w-xs" placeholder="approval reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button
                      variant="outline"
                      disabled={reason.trim().length < 3}
                      onClick={async () => {
                        try {
                          const r = await clientApi.post<MisProfile>(`/mis/profiles/${p.id}/approve`, { reason });
                          setP(r.data);
                          setMsg('Approved — imports for this bank now run under this version.');
                          router.refresh();
                        } catch (e) {
                          fail(e, 'Could not approve.');
                        }
                      }}
                    >
                      Approve
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Known values</CardTitle>
              <CardDescription>Values observed so far per field. New values in a file are flagged in preview and stored verbatim — never translated.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1 text-xs">
              {Object.entries(p.knownValues ?? {}).map(([f, vals]) => (
                <p key={f}>
                  <strong>{f}</strong>: {vals.join(' · ')}
                </p>
              ))}
              {!p.knownValues || Object.keys(p.knownValues).length === 0 ? <p className="text-muted-foreground">None recorded.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
