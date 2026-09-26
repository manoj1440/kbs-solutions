'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { CheckCircle2, Eye, FileSpreadsheet, Info, MapPin, Rows3, Save, Settings2, TriangleAlert, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BankMark, Callout, EmptyState, Field, humanize, PageHeader, SectionCard, selectClass } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const areaClass =
  'w-full rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-[inset_0_1px_1px_rgb(15_23_42/3%)] outline-none hover:border-slate-300 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60';

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
  const imported = p.batches.filter((b) => b.status === 'IMPORTED').length;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={MapPin}
        tone="violet"
        eyebrow="Sales operations · Bank coverage"
        title={
          <>
            {p.bank.displayName} — {p.name}
          </>
        }
        meta={
          <>
            <BankMark code={p.bank.code} size="sm" />
            <Badge variant={p.status === 'APPROVED' ? 'success' : p.status === 'DRAFT' ? 'warning' : 'unknown'}>
              {humanize(p.status)} v{p.version}
            </Badge>
            <span>
              <span className="tabular-nums">{p.batches.length}</span> batch{p.batches.length === 1 ? '' : 'es'} · <span className="tabular-nums">{imported}</span> imported
            </span>
          </>
        }
      />
      {msg ? (
        <Callout tone="neutral" icon={Info} role="status">
          {msg}
        </Callout>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={Settings2} tone="violet" title="Mapping & semantics" description="Headers must match the bank sheet exactly. The rule decides sourceability per row; preserved columns are kept raw and never used as a filter." className="self-start">
          <div className="grid gap-4">
            <Field label="Name" htmlFor="pp-name">
              <Input id="pp-name" disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Sheet name (blank = first sheet)" htmlFor="pp-sheet">
              <Input id="pp-sheet" disabled={readOnly} value={form.sheetName} onChange={(e) => setForm({ ...form, sheetName: e.target.value })} />
            </Field>
            <Field label="Expected headers (one per line)" htmlFor="pp-headers">
              <textarea id="pp-headers" disabled={readOnly} className={cn(areaClass, 'min-h-32 font-mono text-xs')} value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} />
            </Field>
            <Field label="Pincode column" htmlFor="pp-pincol">
              <Input id="pp-pincol" disabled={readOnly} value={form.pincodeColumn} onChange={(e) => setForm({ ...form, pincodeColumn: e.target.value })} />
            </Field>
            <Field label="Rule" htmlFor="pp-rule">
              <select id="pp-rule" disabled={readOnly} className={selectClass} value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value as Rule['rule'] })}>
                <option value="PRESENT_PINCODE_IS_SOURCEABLE">Present pincode is sourceable</option>
                <option value="FLAG_EQUALS">Flag column equals one of…</option>
                <option value="REQUIRES_BANK_MAPPING">Requires bank mapping (nothing sourceable yet)</option>
              </select>
            </Field>
            {form.rule === 'FLAG_EQUALS' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Flag column" htmlFor="pp-col">
                  <Input id="pp-col" disabled={readOnly} value={form.column} onChange={(e) => setForm({ ...form, column: e.target.value })} />
                </Field>
                <Field label="True values (comma-separated)" htmlFor="pp-true">
                  <Input id="pp-true" disabled={readOnly} value={form.trueValues} onChange={(e) => setForm({ ...form, trueValues: e.target.value })} />
                </Field>
              </div>
            ) : null}
            <Field label="Preserved columns (comma-separated; shown in preview, never a filter)" htmlFor="pp-preserve">
              <Input id="pp-preserve" disabled={readOnly} value={form.preserve} onChange={(e) => setForm({ ...form, preserve: e.target.value })} />
            </Field>
            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5 accent-teal-700" disabled={readOnly} checked={form.padNumericPincodes} onChange={(e) => setForm({ ...form, padNumericPincodes: e.target.checked })} />
              Zero-pad numeric cells to 6 digits (recorded per row as wasPadded)
            </label>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button disabled={readOnly} onClick={save}>
                <Save />
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
                  <CheckCircle2 />
                  Approve
                </Button>
              ) : null}
            </div>
          </div>
        </SectionCard>
        <div className="grid content-start gap-6">
          <SectionCard icon={Upload} tone="sky" title="Import a batch" description="Upload the bank workbook → header check → preview (counts, distinct flag values) → confirm. Previous batches stay for history; the latest imported batch under an approved profile is what the apps read.">
            <div className="grid gap-3">
              {!readOnly ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/40 px-4 py-5 text-center">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-100">
                    <FileSpreadsheet className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-xs text-slate-500">Excel (.xlsx) or CSV</p>
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
                </div>
              ) : null}
              {batch?.preview ? (
                <div className="grid gap-3 text-sm">
                  {batch.preview.headerCheck.ok ? (
                    <Callout tone="success" icon={CheckCircle2}>
                      Header check: <Badge variant="success">ok</Badge>
                    </Callout>
                  ) : (
                    <Callout tone="danger" icon={TriangleAlert}>
                      Header check: <Badge variant="destructive">mismatch</Badge> missing: {batch.preview.headerCheck.missing.join(', ') || '—'}; unknown: {batch.preview.headerCheck.unknown.join(', ') || '—'}
                    </Callout>
                  )}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {Object.entries(batch.preview.counts).map(([k, v]) => (
                      <span key={k} className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">
                        {k} <strong className="text-slate-900 tabular-nums">{v}</strong>
                      </span>
                    ))}
                  </div>
                  {Object.entries(batch.preview.distinctFlagValues).map(([col, vals]) => (
                    <p key={col} className="text-xs text-slate-600">
                      <strong className="text-slate-900">{col}</strong>:{' '}
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
                        <CheckCircle2 />
                        Confirm import
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SectionCard>
          <SectionCard icon={FileSpreadsheet} tone="indigo" title="Batches" flush={p.batches.length > 0}>
            {p.batches.length === 0 ? (
              <EmptyState icon={FileSpreadsheet} title="No batches yet." />
            ) : (
              <Table responsive>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell data-label="File" className="text-xs break-all">
                        {b.file.originalName}
                      </TableCell>
                      <TableCell data-label="Uploaded" className="text-xs">
                        {formatDateTime(b.uploadedAt)}
                        <div className="text-[11px] text-slate-500">{b.uploader.fullName}</div>
                      </TableCell>
                      <TableCell data-label="Status">
                        <Badge variant={b.status === 'IMPORTED' ? 'success' : 'unknown'}>{humanize(b.status)}</Badge>
                      </TableCell>
                      <TableCell data-label="Rows" className="tabular-nums sm:text-right">
                        {b.rowCount ?? '—'}
                      </TableCell>
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
                            <Eye />
                            Explore rows (audited)
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>
      </div>
      {rows ? (
        <SectionCard icon={Rows3} tone="slate" title={`Rows (first ${rows.data.length} of ${rows.total})`} description="Raw values exactly as in the sheet; this view is logged." flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Row</TableHead>
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
                  <TableCell className="text-right text-xs tabular-nums">{r.sourceRowNumber}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.pincode || '(invalid)'}
                    {r.wasPadded ? ' *' : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.sourceability === 'SOURCEABLE' ? 'success' : r.sourceability === 'NOT_SOURCEABLE' ? 'unknown' : 'warning'}>{humanize(r.sourceability)}</Badge>
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
        </SectionCard>
      ) : null}
    </div>
  );
}
