import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

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
  payment: { id: string; paidAt: string; amountInr: number; transferReference: string; state: string; proofFileId: string | null } | null;
}

/** F-604 approval detail: itemised cards with MIS evidence, rule/rate version, prior requests and warnings; two approval rows. */
export async function PayoutRequestDetail({ id, backHref, leadHref }: { id: string; backHref: string; leadHref: (leadId: string) => string }) {
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
                Payment {r.payment.state.toLowerCase()} · {formatInr(r.payment.amountInr)} · ref <code>{r.payment.transferReference}</code> · {formatDateTime(r.payment.paidAt)}
              </p>
            ) : r.state === 'APPROVED' ? (
              <p className="text-muted-foreground text-sm">Both approved — awaiting Accounts payment.</p>
            ) : null}
          </CardContent>
        </Card>
        <RequestActions request={r} />
      </div>
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
                    <Link className="underline" href={leadHref(i.lead.id)}>
                      {i.lead.publicRef}
                    </Link>
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
