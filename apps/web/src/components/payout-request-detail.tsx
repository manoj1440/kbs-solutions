import { formatDateTime, formatInr } from '@kbs/shared';
import { Ban, Banknote, Check, Circle, Clock, CreditCard, PauseCircle, UserCheck, Wallet, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { PayeeReveal, PaymentActions, ProofLink } from '@/components/payment-actions';
import { RequestActions } from '@/components/payout-request-actions';
import { PayoutStateBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, BankMark, Callout, KeyValueGrid, PageHeader, SectionCard } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Approval {
  by: { id: string; fullName: string; role: string };
  decision: string;
  reason: string | null;
  at: string;
}
export interface PayoutRequestDto {
  id: string;
  publicRef: string;
  state: string;
  advisor: { id: string; fullName: string };
  managerApprover: { id: string; fullName: string } | null;
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  approvals: {
    manager: Approval | null;
    admin: Approval | null;
    outstanding: string[];
    order: string;
  };
  me: { role: 'MANAGER' | 'ADMIN' | null; canApprove: boolean; canCancel: boolean };
  items: {
    id: string;
    entitlementId: string;
    amountSnapshotInr: number;
    entitlementState: string;
    warnings: string[];
    lead: { id: string; publicRef: string; customerFullName: string };
    bank: { code: string; displayName: string };
    card: string;
    triggerField: string;
    triggerFieldValue: string;
    rule: { name: string; version: number };
    evidence: { batchRef: string; uploadedAt: string };
    eligibleAt: string;
    priorRequests: { id: string; publicRef: string; state: string; submittedAt: string }[];
  }[];
  receipt: {
    state: string;
    paidAt: string;
    amountInr: number;
    transferReferenceMasked: string | null;
    method: string | null;
  } | null;
  payment: PaymentEntry | null;
  pendingCorrection: PaymentEntry | null;
  paymentHistory: PaymentEntry[];
  paidAt: string | null;
  hold: { reason: string; at: string | null; byUserId: string | null } | null;
  payee: {
    accountHolderName: string | null;
    bankName: string | null;
    ifsc: string | null;
    accountMasked: string | null;
    verified: boolean;
    canReveal: boolean;
  } | null;
  payments: {
    proofRequired: boolean;
    canRecord: boolean;
    canAttachProof: boolean;
    canCorrect: boolean;
    canDecideCorrection: boolean;
    canFlag: boolean;
    canResolve: boolean;
  };
}
export interface PaymentEntry {
  id: string;
  state: string;
  paidAt: string;
  amountInr: number;
  transferReference: string;
  method: string | null;
  proofFileId: string | null;
  proofAttachedAt: string | null;
  recordedBy: { id: string; fullName: string };
  recordedAt: string;
  exceptionReason: string | null;
  exceptionRaisedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  correctionOfId: string | null;
  correctionReason: string | null;
  correctionDecision: {
    by: { id: string; fullName: string } | null;
    at: string;
    reason: string | null;
  } | null;
  supersededAt: string | null;
}

const PAYMENT_STATE: Record<string, { label: string; tone: 'success' | 'warning' | 'destructive' | 'info' | 'unknown' }> = {
  VERIFIED: { label: 'verified', tone: 'success' },
  PROOF_PENDING: { label: 'proof pending', tone: 'warning' },
  RECORDED: { label: 'recorded', tone: 'info' },
  EXCEPTION: { label: 'exception', tone: 'destructive' },
  CORRECTION_PENDING: { label: 'correction awaiting Admin', tone: 'warning' },
  SUPERSEDED: { label: 'superseded', tone: 'unknown' },
  CORRECTION_REJECTED: { label: 'correction rejected', tone: 'unknown' },
};

/** F-604 approval detail: itemised cards with MIS evidence, rule/rate version, prior requests and warnings; two approval rows. */
export async function PayoutRequestDetail({ id, backHref, leadHref }: { id: string; backHref: string; leadHref?: (leadId: string) => string }) {
  const r = (await apiFetch<PayoutRequestDto>(`/payouts/requests/${id}`)).data;
  const pending = r.state === 'PENDING_APPROVALS';
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Wallet}
        eyebrow={backHref.startsWith('/admin') ? 'Bank data & finance' : backHref.startsWith('/accounts') ? 'Accounts' : 'Team payouts'}
        title={<span className="tabular-nums">{formatInr(r.totalAmountInr)}</span>}
        meta={
          <>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] font-semibold text-slate-700">{r.publicRef}</span>
            <PayoutStateBadge state={r.state} />
            <span>{r.itemCount} card event(s)</span>
          </>
        }
        description={
          <>
            Submitted {formatDateTime(r.submittedAt)} by {r.advisor.fullName} · Manager approver {r.managerApprover?.fullName ?? '—'} · order {r.approvals.order}
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href={backHref}>← Requests</Link>
          </Button>
        }
      >
        <Journey r={r} />
      </PageHeader>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard icon={UserCheck} tone="violet" title="Approvals" description="Both the assigned Manager and the Admin must approve. One person never holds both.">
          <ol className="grid gap-0">
            <ApprovalRow label={`Manager (${r.managerApprover?.fullName ?? '—'})`} a={r.approvals.manager} pending={pending} />
            <ApprovalRow label="Admin" a={r.approvals.admin} pending={pending} last />
          </ol>
          <div className="mt-4 grid gap-2 empty:hidden">
            {r.state === 'CANCELLED' ? (
              <Callout tone="neutral" icon={Ban}>
                Cancelled {r.cancelledAt ? formatDateTime(r.cancelledAt) : ''}: {r.cancelReason}
              </Callout>
            ) : null}
            {r.payment ? (
              <Callout tone={PAYMENT_STATE[r.payment.state]?.tone === 'success' ? 'success' : 'info'} icon={Banknote}>
                Payment {PAYMENT_STATE[r.payment.state]?.label ?? r.payment.state.toLowerCase()} · <span className="tabular-nums">{formatInr(r.payment.amountInr)}</span> · ref <code>{r.payment.transferReference}</code> · {formatDateTime(r.payment.paidAt)}
              </Callout>
            ) : r.state === 'APPROVED' ? (
              <Callout tone="info" icon={Clock}>
                Both approved — awaiting Accounts payment.
              </Callout>
            ) : null}
          </div>
        </SectionCard>
        {r.state === 'PENDING_APPROVALS' || r.me.canCancel ? <RequestActions request={r} /> : <PaymentActions request={r} />}
      </div>
      {r.state === 'PENDING_APPROVALS' || r.me.canCancel ? <PaymentActions request={r} /> : null}
      <PaymentTrace r={r} />
      <SectionCard icon={CreditCard} tone="indigo" title="Itemised card events" description="Evidence from the bank MIS, the rule/rate version in force at eligibility, and any earlier requests for the same lead." flush>
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Bank / card</TableHead>
              <TableHead>MIS evidence</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Warnings / prior</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell data-label="Lead" className="whitespace-nowrap">
                  {leadHref ? (
                    <Link className="font-mono text-xs font-semibold" href={leadHref(i.lead.id)}>
                      {i.lead.publicRef}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs font-semibold">{i.lead.publicRef}</span>
                  )}
                  <div className="text-[11px] text-slate-500">{i.lead.customerFullName}</div>
                </TableCell>
                <TableCell data-label="Bank / card" className="text-xs">
                  <div className="flex items-center gap-2.5">
                    <BankMark code={i.bank.code} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{i.bank.displayName}</div>
                      <div className="text-[11px] text-slate-500">{i.card}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell data-label="MIS evidence" className="text-xs whitespace-normal">
                  <code>{i.triggerField}</code> = “{i.triggerFieldValue}”
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    batch {i.evidence.batchRef} · {formatDateTime(i.evidence.uploadedAt)} · eligible {formatDateTime(i.eligibleAt)}
                  </div>
                </TableCell>
                <TableCell data-label="Rule" className="text-xs">
                  {i.rule.name} <span className="text-slate-500">v{i.rule.version}</span>
                </TableCell>
                <TableCell data-label="Amount" className="font-semibold whitespace-nowrap text-slate-900 tabular-nums sm:text-right">
                  {formatInr(i.amountSnapshotInr)}
                </TableCell>
                <TableCell data-label="Warnings / prior" className="text-xs whitespace-normal">
                  {i.warnings.map((w) => (
                    <Badge key={w} variant="warning" className="mr-1 mb-1">
                      {w}
                    </Badge>
                  ))}
                  {i.priorRequests.length ? <div className="text-slate-500">Prior: {i.priorRequests.map((p) => `${p.publicRef} (${p.state.toLowerCase()})`).join(', ')}</div> : null}
                  {i.entitlementState !== 'RESERVED' && i.entitlementState !== 'PAID' ? <div className="text-slate-500">entitlement now {i.entitlementState.toLowerCase()}</div> : null}
                  {!i.warnings.length && !i.priorRequests.length && (i.entitlementState === 'RESERVED' || i.entitlementState === 'PAID') ? <span className="text-slate-400">—</span> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

type StepState = 'done' | 'rejected' | 'current' | 'upcoming';
const STEP_CLS: Record<StepState, string> = {
  done: 'bg-emerald-500 text-white ring-emerald-500',
  rejected: 'bg-rose-500 text-white ring-rose-500',
  current: 'bg-white text-amber-600 ring-amber-400',
  upcoming: 'bg-white text-slate-400 ring-slate-200',
};
const STEP_ICON: Record<StepState, LucideIcon> = {
  done: Check,
  rejected: X,
  current: Clock,
  upcoming: Circle,
};

/** Request journey from existing fields only: submitted → Manager → Admin → payment recorded → paid. Approval is not payment. */
function Journey({ r }: { r: PayoutRequestDto }) {
  const approval = (a: Approval | null): [StepState, string] => (a ? [a.decision === 'APPROVED' ? 'done' : 'rejected', `${a.decision.toLowerCase()} · ${a.by.fullName}`] : r.state === 'PENDING_APPROVALS' ? ['current', 'pending'] : ['upcoming', '—']);
  const bothApproved = r.approvals.manager?.decision === 'APPROVED' && r.approvals.admin?.decision === 'APPROVED';
  const steps: { title: string; state: StepState; detail: string; at?: string | null }[] = [
    { title: 'Submitted', state: 'done', detail: r.advisor.fullName, at: r.submittedAt },
    {
      title: 'Manager approval',
      state: approval(r.approvals.manager)[0],
      detail: approval(r.approvals.manager)[1],
      at: r.approvals.manager?.at,
    },
    {
      title: 'Admin approval',
      state: approval(r.approvals.admin)[0],
      detail: approval(r.approvals.admin)[1],
      at: r.approvals.admin?.at,
    },
    {
      title: 'Payment recorded',
      state: r.payment ? 'done' : bothApproved && r.state !== 'CANCELLED' ? 'current' : 'upcoming',
      detail: r.payment ? (PAYMENT_STATE[r.payment.state]?.label ?? r.payment.state.toLowerCase()) : bothApproved ? 'awaiting Accounts' : '—',
      at: r.payment?.recordedAt,
    },
    {
      title: 'Paid',
      state: r.state === 'PAID' ? 'done' : 'upcoming',
      detail: r.state === 'PAID' ? 'confirmed transfer' : '—',
      at: r.paidAt,
    },
  ];
  return (
    <ol aria-label="Request progress" className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)] sm:grid-cols-5 sm:gap-0 sm:p-5">
      {steps.map((s, i) => {
        const Icon = STEP_ICON[s.state];
        return (
          <li key={s.title} className="relative flex items-start gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
            {i > 0 ? <span aria-hidden="true" className={cn('absolute top-3.5 right-1/2 hidden h-0.5 w-full -translate-x-3.5 sm:block', steps[i - 1].state === 'done' ? 'bg-emerald-300' : 'bg-slate-200')} /> : null}
            <span className={cn('relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full ring-2', STEP_CLS[s.state])} aria-hidden="true">
              <Icon className="size-3.5" strokeWidth={3} />
            </span>
            <div className="min-w-0 sm:px-2">
              <div className="text-[13px] font-semibold text-slate-900">{s.title}</div>
              <div className="text-[12px] text-slate-600">{s.detail}</div>
              {s.at ? <div className="text-[11px] text-slate-400">{formatDateTime(s.at)}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ApprovalRow({ label, a, pending, last }: { label: string; a: Approval | null; pending: boolean; last?: boolean }) {
  const state: StepState = a ? (a.decision === 'APPROVED' ? 'done' : 'rejected') : pending ? 'current' : 'upcoming';
  const Icon = STEP_ICON[state];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? <span aria-hidden="true" className="absolute top-8 bottom-0 left-[13px] w-0.5 bg-slate-200" /> : null}
      <span className={cn('relative inline-flex size-7 shrink-0 items-center justify-center rounded-full ring-2', STEP_CLS[state])} aria-hidden="true">
        <Icon className="size-3.5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{label}</span>
          {a ? <Badge variant={a.decision === 'APPROVED' ? 'success' : 'destructive'}>{a.decision.toLowerCase()}</Badge> : <Badge variant={pending ? 'warning' : 'unknown'}>{pending ? 'pending' : '—'}</Badge>}
        </div>
        {a ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <Avatar name={a.by.fullName} size="sm" className="size-5 text-[8px]" />
            {a.by.fullName} · {formatDateTime(a.at)}
            {a.reason ? ` · ${a.reason}` : ''}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** F-605 payment trace: payee (Accounts/Admin), hold, and every payment entry incl. superseded ones (REQ-18 §18.3). */
function PaymentTrace({ r }: { r: PayoutRequestDto }) {
  const show = r.payee || r.hold || r.paymentHistory.length > 0 || ['APPROVED', 'ON_HOLD', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID'].includes(r.state);
  if (!show) return null;
  return (
    <SectionCard
      icon={Banknote}
      tone="emerald"
      title="Payment"
      description={r.state === 'PAID' ? `Paid ${r.paidAt ? formatDateTime(r.paidAt) : ''} — every card event in this request is Paid for this event.` : r.state === 'APPROVED' ? 'Both approved — awaiting Accounts payment.' : 'Recorded transfers made outside KBS. Earlier entries are kept when corrected.'}
    >
      <div className="grid gap-5">
        {r.hold ? (
          <Callout role="alert" tone="danger" icon={PauseCircle}>
            <span className="font-medium">On hold for Admin review:</span> {r.hold.reason}
            {r.hold.at ? <span className="opacity-75"> · {formatDateTime(r.hold.at)}</span> : null}
          </Callout>
        ) : null}
        {r.payee ? (
          <KeyValueGrid
            cols={3}
            className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4"
            items={[
              [
                'Payee',
                <span key="p" className="inline-flex flex-wrap items-center gap-1.5">
                  {r.payee.accountHolderName ?? '—'} {r.payee.verified ? <Badge variant="success">verified at onboarding</Badge> : <Badge variant="warning">not verified</Badge>}
                </span>,
              ],
              [
                'Bank · IFSC',
                <span key="b">
                  {r.payee.bankName ?? '—'} · <code>{r.payee.ifsc ?? '—'}</code>
                </span>,
              ],
              [
                'Account',
                <span key="a" className="inline-flex flex-wrap items-center gap-2">
                  <code>{r.payee.accountMasked ?? 'not on file'}</code>
                  {r.payee.canReveal && r.payee.accountMasked ? <PayeeReveal requestId={r.id} /> : null}
                </span>,
              ],
            ]}
          />
        ) : null}
        {r.paymentHistory.length ? (
          <div className="-mx-5 border-t border-slate-100 sm:-mx-6">
            <Table responsive>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry</TableHead>
                  <TableHead>Transfer</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.paymentHistory.map((p) => (
                  <TableRow key={p.id} className={p.supersededAt ? 'opacity-70' : undefined}>
                    <TableCell data-label="Entry" className="text-xs">
                      <Badge variant={PAYMENT_STATE[p.state]?.tone ?? 'unknown'}>{PAYMENT_STATE[p.state]?.label ?? p.state}</Badge>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {p.recordedBy.fullName} · {formatDateTime(p.recordedAt)}
                      </div>
                    </TableCell>
                    <TableCell data-label="Transfer" className="text-xs">
                      <span className="font-semibold text-slate-900 tabular-nums">{formatInr(p.amountInr)}</span> · {p.method ?? '—'}
                      <div className="text-slate-600">
                        <code>{p.transferReference}</code> · paid {formatDateTime(p.paidAt)}
                      </div>
                    </TableCell>
                    <TableCell data-label="Proof" className="text-xs">
                      {p.proofFileId ? <ProofLink fileId={p.proofFileId} /> : <span className="text-slate-500">none</span>}
                    </TableCell>
                    <TableCell data-label="Notes" className="text-xs whitespace-normal">
                      {p.correctionReason ? <div>Correction: {p.correctionReason}</div> : null}
                      {p.correctionDecision ? (
                        <div className="text-slate-500">
                          Admin {p.state === 'CORRECTION_REJECTED' ? 'rejected' : 'approved'} ({p.correctionDecision.by?.fullName ?? '—'}, {formatDateTime(p.correctionDecision.at)}): {p.correctionDecision.reason}
                        </div>
                      ) : null}
                      {p.exceptionReason ? <div className="text-destructive">{p.exceptionReason}</div> : null}
                      {p.resolutionNote ? <div className="text-slate-500">Resolved: {p.resolutionNote}</div> : null}
                      {p.supersededAt ? <div className="text-slate-500">Superseded {formatDateTime(p.supersededAt)}</div> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : r.receipt ? (
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{formatInr(r.receipt.amountInr)}</span> · ref {r.receipt.transferReferenceMasked} · {formatDateTime(r.receipt.paidAt)}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
