import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

import { AcknowledgeException } from '@/components/payout-exception-ack';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

type Tot = { count: number; amountInr: number };
interface ExceptionItem {
  kind: string;
  subjectId: string;
  request: { id: string; publicRef: string; state: string } | null;
  advisor: { id: string; fullName: string } | null;
  amountInr: number | null;
  detail: string;
  raisedAt: string;
  acknowledgeable: boolean;
  resolvedVia: string | null;
}
interface Dashboard {
  totals: Record<'eligible' | 'available' | 'requested' | 'approvedUnpaid' | 'onHold' | 'paid' | 'underReview' | 'pendingHold' | 'void', Tot>;
  confirmedTransfers: Tot;
  approvals: { pendingCount: number; pendingAmountInr: number; awaitingManager: number; awaitingAdmin: number; aging: { d0_7: number; d8_14: number; d15_30: number; d31plus: number } };
  missingProof: number;
  exceptions: { total: number; byKind: Record<string, number>; items: ExceptionItem[] };
  meta: { dateBasis: string; from: string | null; to: string | null; staleDays: number; asOf: string; source: string };
}
interface Bank {
  id: string;
  displayName: string;
}
const BASIS_LABEL: Record<string, string> = { eligibleAt: 'Eligible date (MIS evidence)', submittedAt: 'Request submitted date', paidAt: 'Paid date' };
const KIND_LABEL: Record<string, string> = {
  PAYMENT_EXCEPTION: 'Payment exception',
  DISCREPANCY_HOLD: 'Returned to Admin',
  MISSING_PROOF: 'Proof missing',
  CORRECTION_PENDING: 'Correction awaiting Admin',
  STALE_REQUEST: 'Stale approval',
  MIS_CORRECTION_AFTER_PAYMENT: 'MIS changed after payment',
  UNDER_REVIEW_IN_REQUEST: 'Under review in request',
};
const sel = 'border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm';

/**
 * F-606 payout liability & reconciliation. Same ledger (and bucket classifier) as the Advisor ledger, so figures
 * reconcile across roles. Date basis is always shown. Approval is not payment; paid = confirmed transfers.
 */
export async function PayoutDashboard({ basePath, requestHref, sp, title, canAcknowledge }: { basePath: string; requestHref: (id: string) => string; sp: Record<string, string | undefined>; title: string; canAcknowledge: boolean }) {
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'dateBasis', 'bankId', 'advisorId', 'managerId']) if (sp[k]) qs.set(k, sp[k] as string);
  const [d, banks] = await Promise.all([apiFetch<Dashboard>(`/dashboards/payouts?${qs.toString()}`).then((r) => r.data), apiFetch<Bank[]>('/catalogue/banks').then((r) => r.data).catch(() => [] as Bank[])]);
  const t = d.totals;
  const tiles: { label: string; tot: Tot; hint: string; tone?: string }[] = [
    { label: 'Eligible card events', tot: t.eligible, hint: 'MIS-evidenced under an approved rule (incl. hold, requested, approved, paid)' },
    { label: 'Available to claim', tot: t.available, hint: 'Not reserved or paid' },
    { label: 'Requested (awaiting approvals)', tot: t.requested, hint: 'Reserved in a pending request' },
    { label: 'Approved, unpaid', tot: t.approvedUnpaid, hint: 'Both approvals; Accounts payment pending' },
    { label: 'On hold', tot: t.onHold, hint: 'Held for Admin review', tone: t.onHold.count ? 'warning' : undefined },
    { label: 'Paid (events)', tot: t.paid, hint: 'Paid for this event' },
    { label: 'Pending hold period', tot: t.pendingHold, hint: 'Rule hold days not yet elapsed' },
    { label: 'Under review', tot: t.underReview, hint: 'MIS no longer reports the trigger value', tone: t.underReview.count ? 'warning' : undefined },
  ];
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">
          Date basis: <strong>{BASIS_LABEL[d.meta.dateBasis] ?? d.meta.dateBasis}</strong>
          {d.meta.from || d.meta.to ? ` · ${d.meta.from ?? '…'} → ${d.meta.to ?? '…'}` : ' · all time'} · as of {formatDateTime(d.meta.asOf)}. {d.meta.source}. Payout states are KBS workflow states, never bank status.
        </p>
      </div>
      <form className="grid items-end gap-2 sm:grid-cols-5" action={basePath}>
        <label className="grid gap-1 text-xs">
          From
          <input className={sel} type="date" name="from" defaultValue={sp.from ?? ''} />
        </label>
        <label className="grid gap-1 text-xs">
          To
          <input className={sel} type="date" name="to" defaultValue={sp.to ?? ''} />
        </label>
        <label className="grid gap-1 text-xs">
          Date basis
          <select className={sel} name="dateBasis" defaultValue={sp.dateBasis ?? 'eligibleAt'}>
            {Object.entries(BASIS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Bank
          <select className={sel} name="bankId" defaultValue={sp.bankId ?? ''}>
            <option value="">All banks</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href={basePath}>Reset</Link>
          </Button>
        </div>
      </form>
      {d.exceptions.total > 0 ? (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {d.exceptions.total} open payout exception(s): {Object.entries(d.exceptions.byKind).map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`).join(' · ')}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((x) => (
          <Card key={x.label} className={x.tone ? 'border-amber-300' : undefined}>
            <CardHeader className="pb-2">
              <CardDescription>{x.label}</CardDescription>
              <CardTitle className="text-2xl">{x.tot.count}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              {formatInr(x.tot.amountInr)} · {x.hint}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Confirmed transfers</CardTitle>
            <CardDescription>Amounts Accounts recorded as transferred outside KBS — not approved totals.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <div className="text-2xl font-semibold">{formatInr(d.confirmedTransfers.amountInr)}</div>
            <div className="text-muted-foreground">{d.confirmedTransfers.count} paid request(s) · {d.missingProof} recorded without proof (not yet Paid)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dual-approval backlog</CardTitle>
            <CardDescription>
              {d.approvals.pendingCount} request(s), {formatInr(d.approvals.pendingAmountInr)} · Manager outstanding {d.approvals.awaitingManager} · Admin outstanding {d.approvals.awaitingAdmin}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-2 text-center text-sm">
            {[
              ['0–7 d', d.approvals.aging.d0_7],
              ['8–14 d', d.approvals.aging.d8_14],
              ['15–30 d', d.approvals.aging.d15_30],
              ['31+ d', d.approvals.aging.d31plus],
            ].map(([l, n]) => (
              <div key={l as string} className="rounded-md border p-2">
                <div className="text-lg font-semibold">{n}</div>
                <div className="text-muted-foreground text-xs">{l}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Exceptions</CardTitle>
          <CardDescription>Derived from the ledger. Stale approvals and bank corrections after payment are acknowledged with a reason; payment issues are resolved on the request. Nothing here claws back or refunds money.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Request / Advisor</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Resolution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.exceptions.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    No open exceptions.
                  </TableCell>
                </TableRow>
              ) : null}
              {d.exceptions.items.map((e) => (
                <TableRow key={`${e.kind}:${e.subjectId}`}>
                  <TableCell data-label="Kind">
                    <Badge variant="warning">{KIND_LABEL[e.kind] ?? e.kind}</Badge>
                    <div className="text-muted-foreground mt-1 text-xs">{formatDateTime(e.raisedAt)}</div>
                  </TableCell>
                  <TableCell data-label="Request / Advisor" className="text-xs">
                    {e.request ? (
                      <Link className="underline" href={requestHref(e.request.id)}>
                        {e.request.publicRef}
                      </Link>
                    ) : (
                      '—'
                    )}
                    <div className="text-muted-foreground">{e.advisor?.fullName ?? ''}</div>
                  </TableCell>
                  <TableCell data-label="Detail" className="text-xs whitespace-normal">
                    {e.detail}
                  </TableCell>
                  <TableCell data-label="Amount" className="whitespace-nowrap">
                    {e.amountInr !== null ? formatInr(e.amountInr) : '—'}
                  </TableCell>
                  <TableCell data-label="Resolution" className="text-xs">
                    {e.acknowledgeable && canAcknowledge ? <AcknowledgeException kind={e.kind} subjectId={e.subjectId} /> : <span className="text-muted-foreground">{e.resolvedVia ?? 'Admin/Accounts acknowledge'}</span>}
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
