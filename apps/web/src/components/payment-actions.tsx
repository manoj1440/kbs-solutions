'use client';

import { ApiClientError, amountInput, formatDateTime, formatInr, PAYMENT_METHODS } from '@kbs/shared';
import { AlertTriangle, Banknote, Eye, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import type { PayoutRequestDto } from '@/components/payout-request-detail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, SectionCard, selectClass } from '@/components/ui/kit';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

const istDate = (ms: number) => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);
const todayIst = () => istDate(Date.now());
/** Date picked in IST → an instant on that IST day: now for today (never in the future), noon IST for earlier days. */
const istInstant = (d: string) => (d === todayIst() ? new Date().toISOString() : new Date(`${d}T12:00:00+05:30`).toISOString());
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function useRunner() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiClientError ? e.message : 'Request failed.' });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { msg, busy, run };
}

function Status({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm' : 'text-destructive text-sm'}>
      {msg.text}
    </p>
  );
}

/**
 * Transfer details form shared by "record payment" and "propose correction". Accounts pays outside KBS first,
 * then records what the bank shows. Nothing here sends money.
 */
function PaymentForm({ request, mode, onDone }: { request: PayoutRequestDto; mode: 'record' | 'correct'; onDone?: () => void }) {
  const { msg, busy, run } = useRunner();
  const prior = request.payment;
  const [date, setDate] = useState(prior ? istDate(Date.parse(prior.paidAt)) : todayIst());
  const [amount, setAmount] = useState(String(prior?.amountInr ?? request.totalAmountInr));
  const [ref, setRef] = useState(prior?.transferReference ?? '');
  const [method, setMethod] = useState(prior?.method ?? 'NEFT');
  const [proof, setProof] = useState<{ id: string; originalName: string } | null>(null);
  const [reason, setReason] = useState('');
  const [key, setKey] = useState(newKey);
  const amt = Number(amount);
  const mismatch = amount !== '' && Math.round(amt * 100) !== Math.round(request.totalAmountInr * 100);
  const valid = date && date <= todayIst() && amt > 0 && ref.trim().length >= 4 && (mode === 'record' || reason.trim().length >= 5);
  const submit = () =>
    run(
      () =>
        clientApi.post(
          mode === 'record' ? `/payouts/requests/${request.id}/payment` : `/payouts/requests/${request.id}/payment/correct`,
          { paidAt: istInstant(date), amountInr: amt, transferReference: ref.trim(), method, ...(proof ? { proofFileId: proof.id } : {}), ...(mode === 'correct' ? { reason: reason.trim() } : {}) },
          key,
        ),
      mode === 'record' ? 'Payment recorded.' : 'Correction sent to Admin for approval.',
    ).then((ok) => {
      if (ok) {
        setKey(newKey());
        onDone?.();
      }
    });
  const id = (s: string) => `${mode}-${s}`;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={id('date')}>Paid on</Label>
          <Input id={id('date')} type="date" max={todayIst()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={id('amount')}>Amount transferred (₹)</Label>
          <Input id={id('amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(amountInput(e.target.value))} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={id('ref')}>Bank transfer reference (UTR)</Label>
          <Input id={id('ref')} value={ref} maxLength={64} onChange={(e) => setRef(e.target.value.replace(/[^A-Za-z0-9 /_.-]/g, ''))} placeholder="e.g. HDFCN52026092312345" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={id('method')}>Method</Label>
          <select id={id('method')} className={selectClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mismatch ? (
        <Callout tone="warning" icon={AlertTriangle}>
          This differs from the approved {formatInr(request.totalAmountInr)}. It will be recorded as an exception and the request held for Admin review — partial or excess payments are never marked Paid.
        </Callout>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FileUploadButton purpose="payment_proof" accept="image/png,image/jpeg,application/pdf" label={proof ? 'Replace proof' : 'Upload proof (PDF/PNG/JPG)'} onUploaded={(f) => setProof(f)} />
        {proof ? <span className="text-muted-foreground">{proof.originalName}</span> : mode === 'correct' && prior?.proofFileId ? <span className="text-muted-foreground">Keeps the existing proof unless replaced.</span> : request.payments.proofRequired ? <span className="text-muted-foreground">Proof is required before the request is marked Paid.</span> : null}
      </div>
      {mode === 'correct' ? (
        <div className="grid gap-1">
          <Label htmlFor={id('reason')}>Why is this correction needed?</Label>
          <Input id={id('reason')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. amount typed as 1000 instead of 1500" />
        </div>
      ) : null}
      <div>
        <Button disabled={busy || !valid} onClick={() => void submit()}>
          {busy ? 'Saving…' : mode === 'record' ? 'Record payment' : 'Send correction for approval'}
        </Button>
      </div>
      <Status msg={msg} />
    </div>
  );
}

function ReasonAction({ label, placeholder, path, ok, variant = 'outline', min = 5 }: { label: string; placeholder: string; path: string; ok: string; variant?: 'outline' | 'destructive' | 'default'; min?: number }) {
  const { msg, busy, run } = useRunner();
  const [reason, setReason] = useState('');
  return (
    <div className="grid gap-2">
      <Input aria-label={`${label} reason`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
      <div>
        <Button variant={variant} disabled={busy || reason.trim().length < min} onClick={() => void run(() => clientApi.post(path, { reason: reason.trim() }), ok).then((d) => d && setReason(''))}>
          {label}
        </Button>
      </div>
      <Status msg={msg} />
    </div>
  );
}

function CorrectionDecision({ request }: { request: PayoutRequestDto }) {
  const { msg, busy, run } = useRunner();
  const [reason, setReason] = useState('');
  const c = request.pendingCorrection;
  if (!c) return null;
  const decide = (decision: 'APPROVED' | 'REJECTED') => run(() => clientApi.post(`/payouts/requests/${request.id}/payment/correction-decision`, { decision, reason: reason.trim() }), decision === 'APPROVED' ? 'Correction approved.' : 'Correction rejected; the earlier entry stays.');
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        Proposed by {c.recordedBy.fullName}: {formatInr(c.amountInr)} · ref <code>{c.transferReference}</code> · {formatDateTime(c.paidAt)} — “{c.correctionReason}”
      </p>
      <Input aria-label="correction decision reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Decision note (required)" />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || reason.trim().length < 3} onClick={() => void decide('APPROVED')}>
          Approve correction
        </Button>
        <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void decide('REJECTED')}>
          Reject correction
        </Button>
      </div>
      <Status msg={msg} />
    </div>
  );
}

function AttachProof({ request }: { request: PayoutRequestDto }) {
  const { msg, run } = useRunner();
  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">The transfer is recorded; upload the bank receipt to mark the request Paid.</p>
      <FileUploadButton purpose="payment_proof" accept="image/png,image/jpeg,application/pdf" label="Upload proof and mark Paid" onUploaded={(f) => void run(() => clientApi.post(`/payouts/requests/${request.id}/payment/proof`, { proofFileId: f.id }), 'Proof attached; request is Paid.')} />
      <Status msg={msg} />
    </div>
  );
}

/** F-605 — Accounts/Admin payment actions for a dual-approved request. */
export function PaymentActions({ request }: { request: PayoutRequestDto }) {
  const f = request.payments;
  const [correcting, setCorrecting] = useState(false);
  const any = f.canRecord || f.canAttachProof || f.canCorrect || f.canDecideCorrection || f.canFlag || f.canResolve;
  if (!any) return null;
  return (
    <SectionCard icon={Banknote} tone="emerald" title={f.canRecord ? 'Record external payment' : 'Payment actions'} description="Pay using your bank or finance tools outside KBS, then record exactly what the bank shows. KBS never transfers money." bodyClassName="grid gap-5 [&>*+*]:border-t [&>*+*]:border-slate-100 [&>*+*]:pt-5">
        {f.canRecord ? <PaymentForm request={request} mode="record" /> : null}
        {f.canAttachProof ? <AttachProof request={request} /> : null}
        {f.canDecideCorrection ? <CorrectionDecision request={request} /> : null}
        {f.canCorrect ? (
          correcting ? (
            <PaymentForm request={request} mode="correct" onDone={() => setCorrecting(false)} />
          ) : (
            <div>
              <Button variant="outline" onClick={() => setCorrecting(true)}>
                Propose a correction
              </Button>
              <p className="text-muted-foreground mt-1 text-xs">Creates a new entry for Admin approval; the current entry is kept for audit.</p>
            </div>
          )
        ) : null}
        {f.canFlag ? (
          <div className="grid gap-1">
            <Label>{request.state === 'PAID' ? 'Report a post-payment issue (reversal, partial, excess)' : 'Return to Admin (amount or bank discrepancy)'}</Label>
            <ReasonAction label={request.state === 'PAID' ? 'Raise exception' : 'Hold and return to Admin'} placeholder="What does not match?" path={`/payouts/requests/${request.id}/payment/flag`} ok="Flagged for Admin review." variant="destructive" />
          </div>
        ) : null}
        {f.canResolve ? (
          <div className="grid gap-1">
            <Label>{request.state === 'ON_HOLD' ? 'Release the hold back to Awaiting payment' : 'Close the post-payment exception'}</Label>
            <ReasonAction label={request.state === 'ON_HOLD' ? 'Release to Accounts' : 'Resolve exception'} placeholder="Resolution note (required)" path={`/payouts/requests/${request.id}/payment/resolve`} ok="Resolved." variant="default" />
          </div>
        ) : null}
    </SectionCard>
  );
}

/** Masked payee bank details with an audited reveal of the full account number. */
export function PayeeReveal({ requestId }: { requestId: string }) {
  const [acct, setAcct] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (acct) return <code className="text-sm">{acct}</code>;
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            const r = await clientApi.get<{ accountNumber: string | null }>(`/payouts/requests/${requestId}/payee?reveal=bank`);
            setAcct(r.data.accountNumber ?? 'Not on file');
          } catch (e) {
            setErr(e instanceof ApiClientError ? e.message : 'Could not reveal.');
          }
        }}
      >
        <Eye />
        Reveal account (logged)
      </Button>
      {err ? <span className="text-destructive text-xs">{err}</span> : null}
    </span>
  );
}

/** Opens the proof via a short-lived presigned URL; the server checks role/team access and logs the access. */
export function ProofLink({ fileId }: { fileId: string }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          try {
            const r = await clientApi.get<{ url: string }>(`/files/${fileId}/url`);
            window.open(r.data.url, '_blank', 'noopener');
          } catch (e) {
            setErr(e instanceof ApiClientError ? e.message : 'Could not open the proof.');
          }
        }}
      >
        <FileText />
        View proof
      </Button>
      {err ? <span className="text-destructive text-xs">{err}</span> : null}
    </span>
  );
}
