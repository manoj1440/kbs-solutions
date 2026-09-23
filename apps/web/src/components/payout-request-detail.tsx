import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

import { PayeeReveal, PaymentActions, ProofLink } from '@/components/payment-actions';
import { RequestActions } from '@/components/payout-request-actions';
import { PayoutStateBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

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
  approvals: { manager: Approval | null; admin: Approval | null; outstanding: string[]; order: string };
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
  receipt: { state: string; paidAt: string; amountInr: number; transferReferenceMasked: string | null; method: string | null } | null;
  payment: PaymentEntry | null;
  pendingCorrection: PaymentEntry | null;
  paymentHistory: PaymentEntry[];
  paidAt: string | null;
  hold: { reason: string; at: string | null; byUserId: string | null } | null;
  payee: { accountHolderName: string | null; bankName: string | null; ifsc: string | null; accountMasked: string | null; verified: boolean; canReveal: boolean } | null;
  payments: { proofRequired: boolean; canRecord: boolean; canAttachProof: boolean; canCorrect: boolean; canDecideCorrection: boolean; canFlag: boolean; canResolve: boolean };
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
  correctionDecision: { by: { id: string; fullName: string } | null; at: string; reason: string | null } | null;
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
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs">{r.publicRef}</p>
          <h1 className="text-2xl font-semibold">
            {formatInr(r.totalAmountInr)} <PayoutStateBadge state={r.state} />
          </h1>
          <p className="text-muted-foreground text-sm">
            {r.itemCount} card event(s) · submitted {formatDateTime(r.submittedAt)} by {r.advisor.fullName} · Manager approver {r.managerApprover?.fullName ?? '—'} · order {r.approvals.order}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={backHref}>← Requests</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>Both the assigned Manager and the Admin must approve. One person never holds both.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <ApprovalRow label={`Manager (${r.managerApprover?.fullName ?? '—'})`} a={r.approvals.manager} pending={r.state === 'PENDING_APPROVALS'} />
            <ApprovalRow label="Admin" a={r.approvals.admin} pending={r.state === 'PENDING_APPROVALS'} />
            {r.state === 'CANCELLED' ? <p className="text-sm">Cancelled {r.cancelledAt ? formatDateTime(r.cancelledAt) : ''}: {r.cancelReason}</p> : null}
            {r.payment ? (
              <p className="text-sm">
                Payment {PAYMENT_STATE[r.payment.state]?.label ?? r.payment.state.toLowerCase()} · {formatInr(r.payment.amountInr)} · ref <code>{r.payment.transferReference}</code> · {formatDateTime(r.payment.paidAt)}
              </p>
            ) : r.state === 'APPROVED' ? (
              <p className="text-muted-foreground text-sm">Both approved — awaiting Accounts payment.</p>
            ) : null}
          </CardContent>
        </Card>
        {r.state === 'PENDING_APPROVALS' || r.me.canCancel ? <RequestActions request={r} /> : <PaymentActions request={r} />}
      </div>
      {r.state === 'PENDING_APPROVALS' || r.me.canCancel ? <PaymentActions request={r} /> : null}
      <PaymentTrace r={r} />
      <Card>
        <CardHeader>
          <CardTitle>Itemised card events</CardTitle>
          <CardDescription>Evidence from the bank MIS, the rule/rate version in force at eligibility, and any earlier requests for the same lead.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Bank / card</TableHead>
                <TableHead>MIS evidence</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Warnings / prior</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    {leadHref ? (
                      <Link className="underline" href={leadHref(i.lead.id)}>
                        {i.lead.publicRef}
                      </Link>
                    ) : (
                      <span>{i.lead.publicRef}</span>
                    )}
                    <div className="text-muted-foreground text-xs">{i.lead.customerFullName}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {i.bank.displayName} · {i.card}
                  </TableCell>
                  <TableCell className="text-xs">
                    <code>{i.triggerField}</code> = “{i.triggerFieldValue}”
                    <div className="text-muted-foreground">
                      batch {i.evidence.batchRef} · {formatDateTime(i.evidence.uploadedAt)} · eligible {formatDateTime(i.eligibleAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {i.rule.name} v{i.rule.version}
                  </TableCell>
                  <TableCell>{formatInr(i.amountSnapshotInr)}</TableCell>
                  <TableCell className="text-xs">
                    {i.warnings.map((w) => (
                      <Badge key={w} variant="warning" className="mr-1">
                        {w}
                      </Badge>
                    ))}
                    {i.priorRequests.length ? <div className="text-muted-foreground">Prior: {i.priorRequests.map((p) => `${p.publicRef} (${p.state.toLowerCase()})`).join(', ')}</div> : null}
                    {i.entitlementState !== 'RESERVED' && i.entitlementState !== 'PAID' ? <div className="text-muted-foreground">entitlement now {i.entitlementState.toLowerCase()}</div> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalRow({ label, a, pending }: { label: string; a: Approval | null; pending: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      {a ? (
        <span className="text-right">
          <Badge variant={a.decision === 'APPROVED' ? 'success' : 'destructive'}>{a.decision.toLowerCase()}</Badge>
          <span className="text-muted-foreground ml-2 text-xs">
            {a.by.fullName} · {formatDateTime(a.at)}
            {a.reason ? ` · ${a.reason}` : ''}
          </span>
        </span>
      ) : (
        <Badge variant={pending ? 'warning' : 'unknown'}>{pending ? 'pending' : '—'}</Badge>
      )}
    </div>
  );
}

/** F-605 payment trace: payee (Accounts/Admin), hold, and every payment entry incl. superseded ones (REQ-18 §18.3). */
function PaymentTrace({ r }: { r: PayoutRequestDto }) {
  const show = r.payee || r.hold || r.paymentHistory.length > 0 || ['APPROVED', 'ON_HOLD', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID'].includes(r.state);
  if (!show) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
        <CardDescription>
          {r.state === 'PAID' ? `Paid ${r.paidAt ? formatDateTime(r.paidAt) : ''} — every card event in this request is Paid for this event.` : r.state === 'APPROVED' ? 'Both approved — awaiting Accounts payment.' : 'Recorded transfers made outside KBS. Earlier entries are kept when corrected.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {r.hold ? (
          <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-md border p-3 text-sm">
            <span className="font-medium">On hold for Admin review:</span> {r.hold.reason}
            {r.hold.at ? <span className="text-muted-foreground"> · {formatDateTime(r.hold.at)}</span> : null}
          </div>
        ) : null}
        {r.payee ? (
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground text-xs">Payee</div>
              {r.payee.accountHolderName ?? '—'} {r.payee.verified ? <Badge variant="success">verified at onboarding</Badge> : <Badge variant="warning">not verified</Badge>}
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Bank · IFSC</div>
              {r.payee.bankName ?? '—'} · <code>{r.payee.ifsc ?? '—'}</code>
            </div>
            <div className="sm:col-span-2">
              <div className="text-muted-foreground text-xs">Account</div>
              <span className="inline-flex flex-wrap items-center gap-2">
                <code>{r.payee.accountMasked ?? 'not on file'}</code>
                {r.payee.canReveal && r.payee.accountMasked ? <PayeeReveal requestId={r.id} /> : null}
              </span>
            </div>
          </div>
        ) : null}
        {r.paymentHistory.length ? (
          <Table>
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
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    <Badge variant={PAYMENT_STATE[p.state]?.tone ?? 'unknown'}>{PAYMENT_STATE[p.state]?.label ?? p.state}</Badge>
                    <div className="text-muted-foreground mt-1">
                      {p.recordedBy.fullName} · {formatDateTime(p.recordedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatInr(p.amountInr)} · {p.method ?? '—'}
                    <div>
                      <code>{p.transferReference}</code> · paid {formatDateTime(p.paidAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{p.proofFileId ? <ProofLink fileId={p.proofFileId} /> : <span className="text-muted-foreground">none</span>}</TableCell>
                  <TableCell className="text-xs">
                    {p.correctionReason ? <div>Correction: {p.correctionReason}</div> : null}
                    {p.correctionDecision ? (
                      <div className="text-muted-foreground">
                        Admin {p.state === 'CORRECTION_REJECTED' ? 'rejected' : 'approved'} ({p.correctionDecision.by?.fullName ?? '—'}, {formatDateTime(p.correctionDecision.at)}): {p.correctionDecision.reason}
                      </div>
                    ) : null}
                    {p.exceptionReason ? <div className="text-destructive">{p.exceptionReason}</div> : null}
                    {p.resolutionNote ? <div className="text-muted-foreground">Resolved: {p.resolutionNote}</div> : null}
                    {p.supersededAt ? <div className="text-muted-foreground">Superseded {formatDateTime(p.supersededAt)}</div> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : r.receipt ? (
          <p className="text-sm">
            {formatInr(r.receipt.amountInr)} · ref {r.receipt.transferReferenceMasked} · {formatDateTime(r.receipt.paidAt)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
