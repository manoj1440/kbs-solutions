'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { ArrowLeft, Check, CheckCircle2, ClipboardCheck, Columns3, EyeOff, FileSpreadsheet, Info, ListChecks, Phone, ShieldAlert, ShieldCheck, TableProperties, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, EmptyState, Field, humanize, Meter, PageHeader, SectionCard, selectClass, StatCard, StatGrid, TONE, type Tone } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const STEPS = ['Upload', 'Map columns', 'Validate', 'Confirm import'] as const;

/** F-806: progress indicator for the existing import steps (presentation only). `current` = index of the step in progress; 4 = all done. */
export function ImportSteps({ current, failed }: { current: number; failed?: boolean }) {
  return (
    <ol aria-label="Import steps" className="grid grid-cols-4 gap-1 sm:gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={label} aria-current={on ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center gap-1.5 text-center">
            {i > 0 ? <span aria-hidden="true" className={cn('absolute top-4 right-[calc(50%+1rem)] h-0.5 w-[calc(100%-1.5rem)] rounded-full', done || on ? 'bg-teal-500' : 'bg-slate-200')} /> : null}
            <span
              className={cn(
                'relative z-10 inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white tabular-nums',
                done ? 'bg-teal-600 text-white' : on ? (failed ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white') : 'bg-slate-100 text-slate-500',
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('text-[11px] leading-tight font-medium sm:text-xs', done ? 'text-teal-700' : on ? 'text-slate-900' : 'text-slate-500')}>
              {label}
              <span className="sr-only">{done ? ' (done)' : on ? ' (current)' : ''}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const STEP_OF: Record<BatchDetail['status'], number> = { UPLOADED: 1, VALIDATED: 3, IMPORTED: 4, FAILED: 1, REJECTED: 1 };
const STATUS_VARIANT: Record<BatchDetail['status'], 'info' | 'warning' | 'success' | 'destructive' | 'unknown'> = { UPLOADED: 'info', VALIDATED: 'warning', IMPORTED: 'success', FAILED: 'destructive', REJECTED: 'unknown' };

function Count({ label, value, total, tone, icon: Icon }: { label: string; value: number; total: number; tone: Tone; icon: typeof Check }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5">
      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
        <Icon className={cn('size-3.5', TONE[tone].text)} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{value}</div>
      <Meter value={value} max={total} tone={tone} className="mt-2 h-1.5" label={label} />
    </div>
  );
}

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
  const vTotal = v ? v.accepted + v.needsReview + v.excluded : 0;
  const alloc = batch.allocation;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Phone}
        eyebrow="Sales operations"
        title={`Batch ${batch.publicRef}`}
        description="Upload → map columns → validate → confirm. Every batch keeps its file, uploader and time; rows are never redistributed automatically."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/calling-list">
              <ArrowLeft />
              All batches
            </Link>
          </Button>
        }
        meta={
          <>
            <Badge variant={STATUS_VARIANT[batch.status] ?? 'info'}>{humanize(batch.status)}</Badge>
            <span className="inline-flex min-w-0 items-center gap-1">
              <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="break-all">{batch.file.originalName}</span>
            </span>
            <span>
              uploaded {formatDateTime(batch.uploadedAt)} by {batch.uploader.fullName} · sheet “{batch.sheetName}”
            </span>
          </>
        }
      >
        <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-4 shadow-[0_1px_2px_rgb(15_23_42/4%)] sm:px-6">
          <ImportSteps current={STEP_OF[batch.status] ?? 1} failed={batch.status === 'FAILED' || batch.status === 'REJECTED'} />
        </div>
      </PageHeader>
      {msg ? (
        <Callout tone="neutral" icon={Info} role="status">
          {msg}
        </Callout>
      ) : null}

      {batch.status !== 'IMPORTED' ? (
        <SectionCard icon={Columns3} tone="teal" title="1 · Map columns" description={`Detected headers: ${headers.join(', ') || '(none)'}. Location is never mapped — it is resolved from the pincode master.`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['name', 'mobile', 'pincode', 'pan'] as const).map((field) => (
              <Field key={field} htmlFor={`map-${field}`} label={field === 'pan' ? 'PAN (optional)' : field.charAt(0).toUpperCase() + field.slice(1)}>
                <select
                  id={`map-${field}`}
                  className={selectClass}
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
              </Field>
            ))}
            <div className="sm:col-span-2 lg:col-span-4">
              <Button disabled={busy || !mapping.name || !mapping.mobile || !mapping.pincode} onClick={validate}>
                <ClipboardCheck />
                {busy ? 'Validating…' : 'Confirm mapping & validate'}
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {batch.preview?.length ? (
        <SectionCard icon={TableProperties} tone="sky" title={`Preview (first ${batch.preview.length} rows, masked)`} description="Mobile and PAN are never shown in full during import (REQ-06 §6.2)." flush>
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead className="sm:text-right">Row</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Pincode</TableHead>
                <TableHead>PAN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.preview.map((r) => (
                <TableRow key={r.row}>
                  <TableCell data-label="Row" className="text-xs text-slate-500 tabular-nums sm:text-right">
                    {r.row}
                  </TableCell>
                  <TableCell data-label="Name" className="font-medium text-slate-800">
                    {r.name}
                  </TableCell>
                  <TableCell data-label="Mobile" className="font-mono text-xs">
                    {r.mobile}
                  </TableCell>
                  <TableCell data-label="Pincode" className="font-mono text-xs">
                    {r.pincode}
                  </TableCell>
                  <TableCell data-label="PAN" className="font-mono text-xs">
                    {r.pan ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      ) : null}

      {v && batch.status === 'VALIDATED' ? (
        <SectionCard
          icon={ListChecks}
          tone="amber"
          title="2 · Validation report"
          description={
            <>
              {batch.totals?.rows} rows: <strong>{v.accepted}</strong> accepted · <strong>{v.needsReview}</strong> need review · <strong>{v.excluded}</strong> excluded.
            </>
          }
        >
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Count label="Accepted" value={v.accepted} total={vTotal} tone="emerald" icon={CheckCircle2} />
              <Count label="Need review" value={v.needsReview} total={vTotal} tone="amber" icon={ListChecks} />
              <Count label="Excluded" value={v.excluded} total={vTotal} tone="slate" icon={EyeOff} />
            </div>
            <ul className="grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(v.byIssue).map(([k, n]) => (
                <li key={k} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <Badge variant={k === 'INVALID_PAN' ? 'info' : k.startsWith('DUPLICATE') || k === 'SUPPRESSED' ? 'unknown' : 'warning'} className="tabular-nums">
                    {n}
                  </Badge>{' '}
                  <span className="min-w-0 text-slate-700">{ISSUE_LABEL[k] ?? k}</span>
                </li>
              ))}
              {Object.keys(v.byIssue).length === 0 ? (
                <li className="flex items-center gap-2 text-slate-500">
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                  No issues found.
                </li>
              ) : null}
            </ul>
            <div className="grid gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />3 · Confirm import
              </h3>
              {batch.complianceGlobalConfirmed ? (
                <Callout tone="success" icon={ShieldCheck}>
                  Calling-list consent is confirmed by compliance (global setting) — accepted rows will be allocated right away.
                </Callout>
              ) : (
                <>
                  <Callout tone="warning" icon={ShieldAlert}>
                    Compliance has not confirmed calling-list consent globally. Attest for this batch to allow allocation, or import now and allocate later (REQ-21 §21.2).
                  </Callout>
                  <label className="flex items-start gap-2 text-sm text-slate-800">
                    <input id="attest" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-teal-700" checked={attest} onChange={(e) => setAttest(e.target.checked)} />I confirm this list was obtained with customer consent / a permitted use basis.
                  </label>
                  {attest ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Source / vendor" htmlFor="vendor">
                        <Input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
                      </Field>
                      <Field label="Permitted-use basis" htmlFor="basis">
                        <Input id="basis" value={basis} onChange={(e) => setBasis(e.target.value)} />
                      </Field>
                    </div>
                  ) : null}
                </>
              )}
              <div>
                <Button disabled={busy || (attest && (!vendor || !basis))} onClick={confirm}>
                  <CheckCircle2 />
                  {busy ? 'Importing…' : `Import ${v.accepted + v.needsReview + v.excluded} rows`}
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {batch.status === 'IMPORTED' ? (
        <>
          <StatGrid>
            <StatCard label="Imported" value={batch.totals?.imported ?? 0} hint="Accepted into calling" icon={CheckCircle2} tone="emerald" />
            <StatCard label="In review" value={batch.totals?.needsReview ?? 0} hint="Accept or exclude below" icon={ListChecks} tone={batch.totals?.needsReview ? 'amber' : 'slate'} />
            <StatCard label="Excluded" value={batch.totals?.excluded ?? 0} hint="Hidden, never deleted" icon={EyeOff} tone="slate" />
            <StatCard label="Assigned" value={alloc ? alloc.assigned : '—'} hint={alloc ? `${alloc.unassigned} unassigned` : 'No allocation yet'} icon={UserCheck} tone="teal" />
          </StatGrid>
          <SectionCard
            icon={Users}
            tone="teal"
            title="Totals"
            description={
              <>
                {batch.totals?.imported ?? 0} imported · {batch.totals?.needsReview ?? 0} in review · {batch.totals?.excluded ?? 0} excluded
                {batch.consentRepresentationConfirmed ? ` · attested (${batch.sourceVendor ?? '—'}; ${batch.permittedUseBasis ?? '—'})` : ''}
              </>
            }
          >
            <div className="grid gap-4">
              {alloc ? (
                <div className="grid gap-2">
                  <p className="text-sm text-slate-700">
                    Assigned <strong className="tabular-nums">{alloc.assigned}</strong> · unassigned <strong className="tabular-nums">{alloc.unassigned}</strong> · hidden <span className="tabular-nums">{alloc.hidden}</span> · suppressed{' '}
                    <span className="tabular-nums">{alloc.suppressed}</span>
                    {batch.allocatedAt ? ` · last allocation ${formatDateTime(batch.allocatedAt)}` : ''}
                  </p>
                  <Meter value={alloc.assigned} max={alloc.assigned + alloc.unassigned} tone="teal" label="Assigned share of allocatable records" />
                </div>
              ) : null}
              {!batch.allocationAllowed ? (
                <Callout tone="danger" icon={ShieldAlert}>
                  Allocation blocked: calling-list consent not confirmed (compliance setting off and no per-batch attestation).
                </Callout>
              ) : alloc && alloc.unassigned > 0 ? (
                <div>
                  <Button disabled={busy} onClick={allocate}>
                    <UserCheck />
                    {busy ? 'Allocating…' : `Allocate ${alloc.unassigned} unassigned`}
                  </Button>
                </div>
              ) : null}
            </div>
          </SectionCard>
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
  useEffect(() => {
    // first load after mount (was scheduled during render, which React rejects)
    const t = setTimeout(() => {
      clientApi
        .get<ReviewRow[]>(`/calling-list/batches/${batchId}/rows?reviewStatus=NEEDS_REVIEW&pageSize=100`)
        .then((r) => setRows(r.data))
        .catch(() => setRows([]));
    }, 0);
    return () => clearTimeout(t);
  }, [batchId]);
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
    <SectionCard
      icon={ListChecks}
      tone="amber"
      title="Review queue"
      description="Rows with invalid or suspicious data. Accepting allocates the row; excluding hides it (nothing is deleted). A reason is required."
      flush={rows?.length !== 0}
    >
      {err ? (
        <Callout tone="danger" icon={ShieldAlert} role="alert" className={rows?.length !== 0 ? 'mx-5 mb-4 sm:mx-6' : 'mb-4'}>
          {err}
        </Callout>
      ) : null}
      {rows?.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing to review." description="Every imported row passed validation or has already been accepted or excluded." />
      ) : (
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead className="sm:text-right">Row</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Pincode · location</TableHead>
              <TableHead>Issues</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell data-label="Row" className="text-xs text-slate-500 tabular-nums sm:text-right">
                  {r.sourceRowNumber}
                </TableCell>
                <TableCell data-label="Name" className="font-medium text-slate-800">
                  {r.fullName}
                </TableCell>
                <TableCell data-label="Mobile" className="font-mono text-xs">
                  {r.mobileMasked}
                </TableCell>
                <TableCell data-label="Pincode · location" className="text-xs">
                  <span className="font-mono">{r.pincode}</span> · {r.location}
                </TableCell>
                <TableCell data-label="Issues">
                  <div className="flex flex-wrap gap-1">
                    {(r.reviewReason ?? '')
                      .split(',')
                      .filter(Boolean)
                      .map((i) => (
                        <Badge key={i} variant="warning">
                          {ISSUE_LABEL[i] ?? i}
                        </Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell data-label="Reason">
                  <Input aria-label={`reason ${r.sourceRowNumber}`} value={reason[r.id] ?? ''} onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })} placeholder="why" className="min-w-32" />
                </TableCell>
                <TableCell data-label="Action">
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => act(r.id, 'ACCEPT')}>
                      Accept
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => act(r.id, 'EXCLUDE')}>
                      Exclude
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
