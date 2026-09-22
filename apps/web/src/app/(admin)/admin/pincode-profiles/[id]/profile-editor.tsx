'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';

type Rule = { rule: 'PRESENT_PINCODE_IS_SOURCEABLE' | 'REQUIRES_BANK_MAPPING'; preserve?: string[]; note?: string; ignoreEmptyAutoHeaders?: boolean } | { rule: 'FLAG_EQUALS'; column: string; trueValues: string[]; preserve?: string[]; note?: string; ignoreEmptyAutoHeaders?: boolean };
export interface ProfileDetail {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
  sheetName: string | null;
  headers: string[];
  pincodeColumn: string;
  semantics: Rule;
  padNumericPincodes: boolean;
  bank: { code: string; displayName: string };
  batches: { id: string; status: string; uploadedAt: string; rowCount: number | null; file: { originalName: string }; uploader: { fullName: string } }[];
}
interface BatchPreview {
  id: string;
  status: string;
  preview?: { headerCheck: { ok: boolean; missing: string[]; unknown: string[]; pincodePresent: boolean }; counts: Record<string, number>; distinctFlagValues: Record<string, Record<string, number>>; sample: { row: number; pincode: string | null; wasPadded: boolean; sourceability: string }[] };
  duplicateOf?: string;
}
interface Row {
  id: string;
  sourceRowNumber: number;
  pincode: string;
  wasPadded: boolean;
  sourceability: string;
  raw: Record<string, string>;
}

export function ProfileEditor({ initial }: { initial: ProfileDetail }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [form, setForm] = useState({ name: initial.name, sheetName: initial.sheetName ?? '', headers: initial.headers.join('\n'), pincodeColumn: initial.pincodeColumn, rule: initial.semantics.rule, column: initial.semantics.rule === 'FLAG_EQUALS' ? initial.semantics.column : '', trueValues: initial.semantics.rule === 'FLAG_EQUALS' ? initial.semantics.trueValues.join(',') : 'Y,YES,TRUE,1', preserve: (initial.semantics.preserve ?? []).join(','), padNumericPincodes: initial.padNumericPincodes });
  const [msg, setMsg] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchPreview | null>(null);
  const [rows, setRows] = useState<{ batchId: string; data: Row[]; total: number } | null>(null);
  const readOnly = p.status === 'RETIRED';
  const fail = (e: unknown, fb: string) => setMsg(e instanceof ApiClientError ? e.message : fb);
  const reload = async (id = p.id) => {
    const r = await clientApi.get<ProfileDetail>(`/pincode-profiles/${id}`);
    setP(r.data);
    router.refresh();
  };
  const save = async () => {
    setMsg(null);
    const headers = form.headers.split('\n').map((s) => s.trim()).filter(Boolean);
    const preserve = form.preserve.split(',').map((s) => s.trim()).filter(Boolean);
    const semantics: Rule = form.rule === 'FLAG_EQUALS' ? { rule: 'FLAG_EQUALS', column: form.column, trueValues: form.trueValues.split(',').map((s) => s.trim()).filter(Boolean), preserve } : { rule: form.rule, preserve };
    try {
      const r = await clientApi.patch<ProfileDetail>(`/pincode-profiles/${p.id}`, { name: form.name, sheetName: form.sheetName || null, headers, pincodeColumn: form.pincodeColumn, semantics, padNumericPincodes: form.padNumericPincodes });
      if (r.data.id !== p.id) {
        setMsg(`Saved as new DRAFT version v${r.data.version} (the approved version stays live until this one is approved).`);
        router.push(`/admin/pincode-profiles/${r.data.id}`);
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
            <CardTitle>Mapping & semantics</CardTitle>
            <CardDescription>Headers must match the bank sheet exactly. The rule decides sourceability per row; preserved columns are kept raw and never used as a filter.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="pp-name">Name</Label>
              <Input id="pp-name" disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="pp-sheet">Sheet name (blank = first sheet)</Label>
              <Input id="pp-sheet" disabled={readOnly} value={form.sheetName} onChange={(e) => setForm({ ...form, sheetName: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="pp-headers">Expected headers (one per line)</Label>
              <textarea id="pp-headers" disabled={readOnly} className="border-input bg-background min-h-32 rounded-md border p-2 font-mono text-xs" value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="pp-pincol">Pincode column</Label>
              <Input id="pp-pincol" disabled={readOnly} value={form.pincodeColumn} onChange={(e) => setForm({ ...form, pincodeColumn: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="pp-rule">Rule</Label>
              <select id="pp-rule" disabled={readOnly} className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value as Rule['rule'] })}>
                <option value="PRESENT_PINCODE_IS_SOURCEABLE">Present pincode is sourceable</option>
                <option value="FLAG_EQUALS">Flag column equals one of…</option>
                <option value="REQUIRES_BANK_MAPPING">Requires bank mapping (nothing sourceable yet)</option>
              </select>
            </div>
            {form.rule === 'FLAG_EQUALS' ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="pp-col">Flag column</Label>
                  <Input id="pp-col" disabled={readOnly} value={form.column} onChange={(e) => setForm({ ...form, column: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="pp-true">True values (comma-separated)</Label>
                  <Input id="pp-true" disabled={readOnly} value={form.trueValues} onChange={(e) => setForm({ ...form, trueValues: e.target.value })} />
                </div>
              </div>
            ) : null}
            <div className="grid gap-1">
              <Label htmlFor="pp-preserve">Preserved columns (comma-separated; shown in preview, never a filter)</Label>
              <Input id="pp-preserve" disabled={readOnly} value={form.preserve} onChange={(e) => setForm({ ...form, preserve: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={readOnly} checked={form.padNumericPincodes} onChange={(e) => setForm({ ...form, padNumericPincodes: e.target.checked })} />
              Zero-pad numeric cells to 6 digits (recorded per row as wasPadded)
            </label>
            <div className="flex gap-2">
              <Button disabled={readOnly} onClick={save}>
                {p.status === 'APPROVED' ? 'Save as new version' : 'Save'}
              </Button>
              {p.status === 'DRAFT' ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await clientApi.post(`/pincode-profiles/${p.id}/approve`, {});
                      await reload();
                      setMsg('Approved — this version is now live for sourceability.');
                    } catch (e) {
                      fail(e, 'Could not approve.');
                    }
                  }}
                >
                  Approve
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Import a batch</CardTitle>
              <CardDescription>Upload the bank workbook → header check → preview (counts, distinct flag values) → confirm. Previous batches stay for history; the latest imported batch under an approved profile is what the apps read.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!readOnly ? (
                <FileUploadButton
                  purpose="bank_pincode"
                  accept=".xlsx,.csv"
                  label="Upload bank sheet"
                  onUploaded={async (f) => {
                    setMsg(null);
                    try {
                      const r = await clientApi.post<BatchPreview>(`/pincode-profiles/${p.id}/batches`, { fileId: f.id });
                      setBatch(r.data);
                      if (r.data.duplicateOf) setMsg('Identical file already uploaded for this profile.');
                    } catch (e) {
                      fail(e, 'Could not create the batch.');
                    }
                  }}
                />
              ) : null}
              {batch?.preview ? (
                <div className="grid gap-2 text-sm">
                  <p>
                    Header check:{' '}
                    {batch.preview.headerCheck.ok ? (
                      <Badge variant="success">ok</Badge>
                    ) : (
                      <>
                        <Badge variant="destructive">mismatch</Badge> missing: {batch.preview.headerCheck.missing.join(', ') || '—'}; unknown: {batch.preview.headerCheck.unknown.join(', ') || '—'}
                      </>
                    )}
                  </p>
                  <p className="text-xs">
                    {Object.entries(batch.preview.counts)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ')}
                  </p>
                  {Object.entries(batch.preview.distinctFlagValues).map(([col, vals]) => (
                    <p key={col} className="text-xs">
                      <strong>{col}</strong>:{' '}
                      {Object.entries(vals)
                        .map(([v, n]) => `${v} (${n})`)
                        .join(', ')}
                    </p>
                  ))}
                  {batch.preview.headerCheck.ok && batch.status !== 'IMPORTED' ? (
                    <div>
                      <Button
                        onClick={async () => {
                          try {
                            await clientApi.post(`/pincode-batches/${batch.id}/confirm`, {});
                            setBatch(null);
                            await reload();
                            setMsg('Batch imported.');
                          } catch (e) {
                            fail(e, 'Could not import.');
                          }
                        }}
                      >
                        Confirm import
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs">{b.file.originalName}</TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(b.uploadedAt)} · {b.uploader.fullName}
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.status === 'IMPORTED' ? 'success' : 'unknown'}>{b.status}</Badge>
                      </TableCell>
                      <TableCell>{b.rowCount ?? '—'}</TableCell>
                      <TableCell>
                        {b.status === 'IMPORTED' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const r = await clientApi.get<Row[]>(`/pincode-batches/${b.id}/rows?pageSize=50`);
                              setRows({ batchId: b.id, data: r.data, total: Number(r.meta.total ?? r.data.length) });
                            }}
                          >
                            Explore rows (audited)
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {p.batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        No batches yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
      {rows ? (
        <Card>
          <CardHeader>
            <CardTitle>Rows (first {rows.data.length} of {rows.total})</CardTitle>
            <CardDescription>Raw values exactly as in the sheet; this view is logged.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Sourceability</TableHead>
                  {Object.keys(rows.data[0]?.raw ?? {}).map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.sourceRowNumber}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.pincode || '(invalid)'}
                      {r.wasPadded ? ' *' : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.sourceability === 'SOURCEABLE' ? 'success' : r.sourceability === 'NOT_SOURCEABLE' ? 'unknown' : 'warning'}>{r.sourceability.replace(/_/g, ' ').toLowerCase()}</Badge>
                    </TableCell>
                    {Object.keys(rows.data[0]?.raw ?? {}).map((h) => (
                      <TableCell key={h} className="text-xs">
                        {r.raw[h]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
