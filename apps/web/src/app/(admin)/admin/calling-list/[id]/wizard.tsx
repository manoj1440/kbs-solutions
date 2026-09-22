'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';

export interface Mapping {
  name: string;
  mobile: string;
  pincode: string;
  pan?: string | null;
}
export interface BatchDetail {
  id: string;
  publicRef: string;
  status: 'UPLOADED' | 'VALIDATED' | 'IMPORTED' | 'FAILED' | 'REJECTED';
  file: { originalName: string; sizeBytes: number };
  uploader: { id: string; fullName: string };
  uploadedAt: string;
  sheetName: string | null;
  headerMapping: { headers: string[]; sheets: string[]; proposed: Partial<Mapping>; confirmed: Mapping | null } | null;
  totals: { rows?: number; imported?: number; needsReview?: number; excluded?: number; byIssue?: Record<string, number>; validation?: { accepted: number; needsReview: number; excluded: number; byIssue: Record<string, number> } } | null;
  consentRepresentationConfirmed: boolean;
  sourceVendor: string | null;
  permittedUseBasis: string | null;
  allocatedAt: string | null;
  allocationAllowed: boolean;
  complianceGlobalConfirmed: boolean;
  allocation: { byReviewStatus: Record<string, number>; assigned: number; unassigned: number; hidden: number; suppressed: number } | null;
  preview?: PreviewRow[];
}
interface PreviewRow {
  row: number;
  name?: string;
  mobile?: string;
  pincode?: string;
  pan?: string;
}
interface ReviewRow {
  id: string;
  sourceRowNumber: number;
  fullName: string;
  mobileMasked: string;
  pincode: string;
  location: string;
  panLast4: string | null;
  reviewStatus: string;
  reviewReason: string | null;
}
interface AllocationRun {
  ran: boolean;
  blockedReason?: string;
  assigned: number;
  unassigned: number;
}

const ISSUE_LABEL: Record<string, string> = {
  INVALID_MOBILE: 'Invalid mobile',
  INVALID_PINCODE: 'Invalid pincode',
  BLANK_NAME: 'Blank name',
  INVALID_PAN: 'PAN format (warning only)',
  DUPLICATE_IN_BATCH: 'Duplicate within file',
  DUPLICATE_OF_EXISTING: 'Already an active customer',
  SUPPRESSED: 'Do-not-contact (suppressed)',
};

export function BatchWizard({ initial }: { initial: BatchDetail }) {
  const router = useRouter();
  const [batch, setBatch] = useState<BatchDetail>(initial);
  const hm = batch.headerMapping;
  const [mapping, setMapping] = useState<Mapping>({
    name: hm?.confirmed?.name ?? hm?.proposed.name ?? '',
    mobile: hm?.confirmed?.mobile ?? hm?.proposed.mobile ?? '',
    pincode: hm?.confirmed?.pincode ?? hm?.proposed.pincode ?? '',
    pan: hm?.confirmed?.pan ?? hm?.proposed.pan ?? null,
  });
  const [attest, setAttest] = useState(false);
  const [vendor, setVendor] = useState('');
  const [basis, setBasis] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown, fallback: string) => setMsg(e instanceof ApiClientError ? e.message : fallback);
  const headers = hm?.headers ?? [];

  const validate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await clientApi.put<BatchDetail>(`/calling-list/batches/${batch.id}/mapping`, mapping);
      setBatch(r.data);
      setMsg('Mapping confirmed — review the validation report below.');
    } catch (e) {
      fail(e, 'Could not validate.');
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await clientApi.post<BatchDetail & { allocation: AllocationRun }>(`/calling-list/batches/${batch.id}/confirm`, attest ? { consentRepresentationConfirmed: true, sourceVendor: vendor, permittedUseBasis: basis } : {});
      const fresh = await clientApi.get<BatchDetail>(`/calling-list/batches/${batch.id}`);
      setBatch(fresh.data);
      const a = r.data.allocation;
      setMsg(a.ran ? `Imported. ${a.assigned} record(s) allocated, ${a.unassigned} unassigned.${a.blockedReason === 'NO_ELIGIBLE_TELECALLER' ? ' No active, training-complete Telecaller is available yet.' : ''}` : `Imported. Allocation not run: ${a.blockedReason === 'COMPLIANCE_NOT_CONFIRMED' ? 'calling-list consent is not confirmed (compliance confirmation or per-batch attestation required).' : a.blockedReason}`);
      router.refresh();
    } catch (e) {
      fail(e, 'Could not confirm.');
    } finally {
      setBusy(false);
    }
  };
  const allocate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await clientApi.post<AllocationRun>(`/calling-list/batches/${batch.id}/allocate`, {});
      const fresh = await clientApi.get<BatchDetail>(`/calling-list/batches/${batch.id}`);
      setBatch(fresh.data);
      setMsg(r.data.assigned > 0 ? `${r.data.assigned} record(s) allocated; ${r.data.unassigned} unassigned.` : r.data.blockedReason === 'NO_ELIGIBLE_TELECALLER' ? 'No active, training-complete Telecaller is available — records stay unassigned.' : 'Nothing to allocate.');
    } catch (e) {
      fail(e, 'Could not allocate.');
    } finally {
      setBusy(false);
    }
  };

  const v = batch.totals?.validation;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Batch {batch.publicRef}</h1>
        <Badge variant={batch.status === 'IMPORTED' ? 'success' : batch.status === 'VALIDATED' ? 'warning' : 'info'}>{batch.status}</Badge>
        <span className="text-muted-foreground text-sm">
          {batch.file.originalName} · uploaded {formatDateTime(batch.uploadedAt)} by {batch.uploader.fullName} · sheet “{batch.sheetName}”
        </span>
      </div>
      {msg ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          {msg}
        </p>
      ) : null}

      {batch.status !== 'IMPORTED' ? (
        <Card>
          <CardHeader>
            <CardTitle>1 · Map columns</CardTitle>
            <CardDescription>Detected headers: {headers.join(', ') || '(none)'}. Location is never mapped — it is resolved from the pincode master.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {(['name', 'mobile', 'pincode', 'pan'] as const).map((field) => (
              <div key={field} className="grid gap-1">
                <Label htmlFor={`map-${field}`}>
                  {field === 'pan' ? 'PAN (optional)' : field.charAt(0).toUpperCase() + field.slice(1)}
                </Label>
                <select
                  id={`map-${field}`}
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={mapping[field] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || (field === 'pan' ? null : '') })}
                >
                  <option value="">{field === 'pan' ? '— not present —' : '— choose —'}</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="md:col-span-4">
              <Button disabled={busy || !mapping.name || !mapping.mobile || !mapping.pincode} onClick={validate}>
                {busy ? 'Validating…' : 'Confirm mapping & validate'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {batch.preview?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview (first {batch.preview.length} rows, masked)</CardTitle>
            <CardDescription>Mobile and PAN are never shown in full during import (REQ-06 §6.2).</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead>PAN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.preview.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell className="text-xs">{r.row}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.mobile}</TableCell>
                    <TableCell className="font-mono text-xs">{r.pincode}</TableCell>
                    <TableCell className="font-mono text-xs">{r.pan ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {v && batch.status === 'VALIDATED' ? (
        <Card>
          <CardHeader>
            <CardTitle>2 · Validation report</CardTitle>
            <CardDescription>
              {batch.totals?.rows} rows: <strong>{v.accepted}</strong> accepted · <strong>{v.needsReview}</strong> need review · <strong>{v.excluded}</strong> excluded.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="grid gap-1 text-sm md:grid-cols-2">
              {Object.entries(v.byIssue).map(([k, n]) => (
                <li key={k}>
                  <Badge variant={k === 'INVALID_PAN' ? 'info' : k.startsWith('DUPLICATE') || k === 'SUPPRESSED' ? 'unknown' : 'warning'}>{n}</Badge> {ISSUE_LABEL[k] ?? k}
                </li>
              ))}
              {Object.keys(v.byIssue).length === 0 ? <li className="text-muted-foreground">No issues found.</li> : null}
            </ul>
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-sm font-medium">3 · Confirm import</p>
              {batch.complianceGlobalConfirmed ? (
                <p className="text-muted-foreground text-sm">Calling-list consent is confirmed by compliance (global setting) — accepted rows will be allocated right away.</p>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">Compliance has not confirmed calling-list consent globally. Attest for this batch to allow allocation, or import now and allocate later (REQ-21 §21.2).</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input id="attest" type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} />I confirm this list was obtained with customer consent / a permitted use basis.
                  </label>
                  {attest ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="grid gap-1">
                        <Label htmlFor="vendor">Source / vendor</Label>
                        <Input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="basis">Permitted-use basis</Label>
                        <Input id="basis" value={basis} onChange={(e) => setBasis(e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              <div>
                <Button disabled={busy || (attest && (!vendor || !basis))} onClick={confirm}>
                  {busy ? 'Importing…' : `Import ${v.accepted + v.needsReview + v.excluded} rows`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {batch.status === 'IMPORTED' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
              <CardDescription>
                {batch.totals?.imported ?? 0} imported · {batch.totals?.needsReview ?? 0} in review · {batch.totals?.excluded ?? 0} excluded
                {batch.consentRepresentationConfirmed ? ` · attested (${batch.sourceVendor ?? '—'}; ${batch.permittedUseBasis ?? '—'})` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {batch.allocation ? (
                <p className="text-sm">
                  Assigned <strong>{batch.allocation.assigned}</strong> · unassigned <strong>{batch.allocation.unassigned}</strong> · hidden {batch.allocation.hidden} · suppressed {batch.allocation.suppressed}
                  {batch.allocatedAt ? ` · last allocation ${formatDateTime(batch.allocatedAt)}` : ''}
                </p>
              ) : null}
              {!batch.allocationAllowed ? (
                <p className="text-destructive text-sm">Allocation blocked: calling-list consent not confirmed (compliance setting off and no per-batch attestation).</p>
              ) : batch.allocation && batch.allocation.unassigned > 0 ? (
                <div>
                  <Button disabled={busy} onClick={allocate}>
                    {busy ? 'Allocating…' : `Allocate ${batch.allocation.unassigned} unassigned`}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <ReviewQueue batchId={batch.id} onChanged={async () => setBatch((await clientApi.get<BatchDetail>(`/calling-list/batches/${batch.id}`)).data)} />
        </>
      ) : null}
    </div>
  );
}

function ReviewQueue({ batchId, onChanged }: { batchId: string; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    const r = await clientApi.get<ReviewRow[]>(`/calling-list/batches/${batchId}/rows?reviewStatus=NEEDS_REVIEW&pageSize=100`);
    setRows(r.data);
  };
  if (rows === null) {
    setTimeout(() => void load().catch(() => setRows([])), 0);
  }
  const act = async (id: string, action: 'ACCEPT' | 'EXCLUDE') => {
    setErr(null);
    try {
      await clientApi.post(`/calling-list/records/${id}/review`, { action, reason: reason[id] ?? '' });
      await load();
      await onChanged();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Could not review.');
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review queue</CardTitle>
        <CardDescription>Rows with invalid or suspicious data. Accepting allocates the row; excluding hides it (nothing is deleted). A reason is required.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {err ? (
          <p role="alert" className="text-destructive text-sm">
            {err}
          </p>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Pincode · location</TableHead>
              <TableHead>Issues</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center">
                  Nothing to review.
                </TableCell>
              </TableRow>
            ) : null}
            {(rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.sourceRowNumber}</TableCell>
                <TableCell>{r.fullName}</TableCell>
                <TableCell className="font-mono text-xs">{r.mobileMasked}</TableCell>
                <TableCell className="text-xs">
                  {r.pincode} · {r.location}
                </TableCell>
                <TableCell className="text-xs">
                  {(r.reviewReason ?? '')
                    .split(',')
                    .filter(Boolean)
                    .map((i) => ISSUE_LABEL[i] ?? i)
                    .join(', ')}
                </TableCell>
                <TableCell>
                  <Input aria-label={`reason ${r.sourceRowNumber}`} value={reason[r.id] ?? ''} onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })} placeholder="why" />
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => act(r.id, 'ACCEPT')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => act(r.id, 'EXCLUDE')}>
                    Exclude
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
