import { formatDateTime, formatInr } from '@kbs/shared';
import { AlertTriangle, BadgeCheck, CalendarClock, CheckCircle2, CircleDollarSign, Filter, Hourglass, Inbox, LayoutDashboard, PauseCircle, PieChart, RotateCcw, SearchCheck, ShieldAlert, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { AcknowledgeException } from '@/components/payout-exception-ack';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, Callout, EmptyState, Meter, PageHeader, SectionCard, selectClass, StatCard, StatGrid, TONE, type Tone } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  approvals: {
    pendingCount: number;
    pendingAmountInr: number;
    awaitingManager: number;
    awaitingAdmin: number;
    aging: { d0_7: number; d8_14: number; d15_30: number; d31plus: number };
  };
  missingProof: number;
  exceptions: { total: number; byKind: Record<string, number>; items: ExceptionItem[] };
  meta: {
    dateBasis: string;
    from: string | null;
    to: string | null;
    staleDays: number;
    asOf: string;
    source: string;
  };
}
interface Bank {
  id: string;
  displayName: string;
}
const BASIS_LABEL: Record<string, string> = {
  eligibleAt: 'Eligible date (MIS evidence)',
  submittedAt: 'Request submitted date',
  paidAt: 'Paid date',
};
const KIND_LABEL: Record<string, string> = {
  PAYMENT_EXCEPTION: 'Payment exception',
  DISCREPANCY_HOLD: 'Returned to Admin',
  MISSING_PROOF: 'Proof missing',
  CORRECTION_PENDING: 'Correction awaiting Admin',
  STALE_REQUEST: 'Stale approval',
  MIS_CORRECTION_AFTER_PAYMENT: 'MIS changed after payment',
  UNDER_REVIEW_IN_REQUEST: 'Under review in request',
};
const labelCls = 'grid min-w-0 gap-1.5 text-[12px] font-medium text-slate-600';

/**
 * F-606 payout liability & reconciliation. Same ledger (and bucket classifier) as the Advisor ledger, so figures
 * reconcile across roles. Date basis is always shown. Approval is not payment; paid = confirmed transfers.
 */
export async function PayoutDashboard({ basePath, requestHref, sp, title, canAcknowledge }: { basePath: string; requestHref: (id: string) => string; sp: Record<string, string | undefined>; title: string; canAcknowledge: boolean }) {
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'dateBasis', 'bankId', 'advisorId', 'managerId']) if (sp[k]) qs.set(k, sp[k] as string);
  const [d, banks] = await Promise.all([
    apiFetch<Dashboard>(`/dashboards/payouts?${qs.toString()}`).then((r) => r.data),
    apiFetch<Bank[]>('/catalogue/banks')
      .then((r) => r.data)
      .catch(() => [] as Bank[]),
  ]);
  const t = d.totals;
  // `inEligible`: the bucket is one of the disjoint buckets whose union is "eligible" (ledger classifier), so its share of the eligible value is meaningful.
  const tiles: {
    label: string;
    tot: Tot;
    hint: string;
    tone?: string;
    icon: LucideIcon;
    color: Tone;
    inEligible?: boolean;
  }[] = [
    {
      label: 'Eligible card events',
      tot: t.eligible,
      hint: 'MIS-evidenced under an approved rule (incl. hold, requested, approved, paid)',
      icon: SearchCheck,
      color: 'indigo',
    },
    {
      label: 'Available to claim',
      tot: t.available,
      hint: 'Not reserved or paid',
      icon: Wallet,
      color: 'teal',
      inEligible: true,
    },
    {
      label: 'Requested (awaiting approvals)',
      tot: t.requested,
      hint: 'Reserved in a pending request',
      icon: Inbox,
      color: 'sky',
      inEligible: true,
    },
    {
      label: 'Approved, unpaid',
      tot: t.approvedUnpaid,
      hint: 'Both approvals; Accounts payment pending',
      icon: CircleDollarSign,
      color: 'violet',
      inEligible: true,
    },
    {
      label: 'On hold',
      tot: t.onHold,
      hint: 'Held for Admin review',
      tone: t.onHold.count ? 'warning' : undefined,
      icon: PauseCircle,
      color: t.onHold.count ? 'amber' : 'slate',
      inEligible: true,
    },
    {
      label: 'Paid (events)',
      tot: t.paid,
      hint: 'Paid for this event',
      icon: CheckCircle2,
      color: 'emerald',
      inEligible: true,
    },
    {
      label: 'Pending hold period',
      tot: t.pendingHold,
      hint: 'Rule hold days not yet elapsed',
      icon: CalendarClock,
      color: 'slate',
      inEligible: true,
    },
    {
      label: 'Under review',
      tot: t.underReview,
      hint: 'MIS no longer reports the trigger value',
      tone: t.underReview.count ? 'warning' : undefined,
      icon: ShieldAlert,
      color: t.underReview.count ? 'amber' : 'slate',
    },
  ];
  const aging: [string, number][] = [
    ['0–7 d', d.approvals.aging.d0_7],
    ['8–14 d', d.approvals.aging.d8_14],
    ['15–30 d', d.approvals.aging.d15_30],
    ['31+ d', d.approvals.aging.d31plus],
  ];
  const agingMax = Math.max(0, ...aging.map(([, n]) => n));
  const eligibleAmount = t.eligible.amountInr;
  const pct = (v: number) => (eligibleAmount > 0 ? `${Math.round((v / eligibleAmount) * 100)}%` : '—');
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={LayoutDashboard}
        eyebrow={basePath.startsWith('/admin') ? 'Bank data & finance' : 'Payouts'}
        title={title}
        description={
          <>
            Date basis: <strong className="font-semibold text-slate-700">{BASIS_LABEL[d.meta.dateBasis] ?? d.meta.dateBasis}</strong>
            {d.meta.from || d.meta.to ? ` · ${d.meta.from ?? '…'} → ${d.meta.to ?? '…'}` : ' · all time'} · as of {formatDateTime(d.meta.asOf)}. {d.meta.source}. Payout states are KBS workflow states, never bank status.
          </>
        }
      >
        <form className="grid items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)] grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_1.3fr_auto]" action={basePath}>
          <label className={labelCls}>
            From
            <Input type="date" name="from" defaultValue={sp.from ?? ''} />
          </label>
          <label className={labelCls}>
            To
            <Input type="date" name="to" defaultValue={sp.to ?? ''} />
          </label>
          <label className={cn(labelCls, 'col-span-2 sm:col-span-1')}>
            Date basis
            <select className={selectClass} name="dateBasis" defaultValue={sp.dateBasis ?? 'eligibleAt'}>
              {Object.entries(BASIS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className={cn(labelCls, 'col-span-2 sm:col-span-1')}>
            Bank
            <select className={selectClass} name="bankId" defaultValue={sp.bankId ?? ''}>
              <option value="">All banks</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            <Button type="submit" className="h-10">
              <Filter />
              Apply
            </Button>
            <Button asChild variant="outline" className="h-10">
              <Link href={basePath}>
                <RotateCcw />
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </PageHeader>
      {d.exceptions.total > 0 ? (
        <Callout role="alert" tone="warning" icon={AlertTriangle}>
          {d.exceptions.total} open payout exception(s):{' '}
          {Object.entries(d.exceptions.byKind)
            .map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`)
            .join(' · ')}
        </Callout>
      ) : null}
      <section aria-label="Ledger buckets" className="grid gap-3">
        <p className="text-xs text-slate-500">Each tile is its own ledger bucket (card events · value). “Eligible” is the union of the buckets that show a share of it; tiles are never added together.</p>
        <StatGrid>
          {tiles.map((x) => (
            <StatCard
              key={x.label}
              label={x.label}
              value={x.tot.count}
              icon={x.icon}
              tone={x.color}
              className={x.tone ? 'border-amber-300' : undefined}
              hint={
                <>
                  <span className={cn('font-semibold tabular-nums', TONE[x.color].text)}>{formatInr(x.tot.amountInr)}</span> · {x.hint}
                </>
              }
              source={x.inEligible ? `${pct(x.tot.amountInr)} of eligible` : x.label === 'Eligible card events' ? 'Union of shares' : 'Outside eligible'}
            />
          ))}
        </StatGrid>
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard icon={PieChart} tone="indigo" title="Where the eligible value sits" description="Each eligible card event sits in exactly one of these buckets; the bar is that bucket’s share of the eligible value.">
          <div className="grid gap-3.5">
            {tiles
              .filter((x) => x.inEligible)
              .map((x) => (
                <div key={x.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2 text-slate-700">
                    <span className={cn('size-2 shrink-0 rounded-full', TONE[x.color].bar)} aria-hidden="true" />
                    <span className="truncate">{x.label}</span>
                    <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">{x.tot.count}</span>
                  </span>
                  <span className="text-right font-medium text-slate-900 tabular-nums">
                    {formatInr(x.tot.amountInr)} <span className="ml-1 inline-block w-9 text-[11px] font-normal text-slate-400">{pct(x.tot.amountInr)}</span>
                  </span>
                  <Meter className="col-span-2 h-1.5" value={x.tot.amountInr} max={eligibleAmount} tone={x.color} label={`${x.label}: share of eligible value`} />
                </div>
              ))}
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[13px]">
              <span className="text-slate-500">Eligible card events ({t.eligible.count})</span>
              <span className="font-semibold text-slate-900 tabular-nums">{formatInr(eligibleAmount)}</span>
            </div>
          </div>
        </SectionCard>
        <div className="grid gap-6">
          <SectionCard icon={BadgeCheck} tone="emerald" title="Confirmed transfers" description="Amounts Accounts recorded as transferred outside KBS — not approved totals.">
            <div className="grid gap-1">
              <div className="text-[30px] leading-10 font-semibold tracking-tight text-slate-900 tabular-nums">{formatInr(d.confirmedTransfers.amountInr)}</div>
              <div className="text-sm text-slate-600">
                {d.confirmedTransfers.count} paid request(s) · {d.missingProof} recorded without proof (not yet Paid)
              </div>
            </div>
          </SectionCard>
          <SectionCard
            icon={Hourglass}
            tone="amber"
            title="Dual-approval backlog"
            description={
              <>
                {d.approvals.pendingCount} request(s), {formatInr(d.approvals.pendingAmountInr)} · Manager outstanding {d.approvals.awaitingManager} · Admin outstanding {d.approvals.awaitingAdmin}
              </>
            }
          >
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['Manager outstanding', d.approvals.awaitingManager],
                    ['Admin outstanding', d.approvals.awaitingAdmin],
                  ] as [string, number][]
                ).map(([l, n]) => (
                  <div key={l} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                    <div className="text-[12px] text-slate-500">{l}</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{n}</div>
                    <Meter className="mt-2 h-1.5" value={n} max={d.approvals.pendingCount} tone="amber" label={`${l} of ${d.approvals.pendingCount} pending`} />
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Age of pending requests</div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {aging.map(([l, n], i) => (
                    <div key={l} className="rounded-xl border border-slate-200/80 p-2.5">
                      <div className="text-lg font-semibold text-slate-900 tabular-nums">{n}</div>
                      <div className="text-xs text-slate-500">{l}</div>
                      <Meter className="mt-2 h-1" value={n} max={agingMax} tone={i >= 2 ? 'rose' : i === 1 ? 'amber' : 'sky'} label={`${l} pending`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
      <SectionCard icon={AlertTriangle} tone="rose" title="Exceptions" description="Derived from the ledger. Stale approvals and bank corrections after payment are acknowledged with a reason; payment issues are resolved on the request. Nothing here claws back or refunds money." flush={d.exceptions.items.length > 0}>
        {d.exceptions.items.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No open exceptions." description="Exceptions appear here when the ledger finds a payment issue, a stale approval or a bank correction after payment." />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Request / Advisor</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Resolution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.exceptions.items.map((e) => (
                <TableRow key={`${e.kind}:${e.subjectId}`}>
                  <TableCell data-label="Kind">
                    <Badge variant="warning">{KIND_LABEL[e.kind] ?? e.kind}</Badge>
                    <div className="mt-1 text-[11px] text-slate-500">{formatDateTime(e.raisedAt)}</div>
                  </TableCell>
                  <TableCell data-label="Request / Advisor" className="text-xs">
                    <div className="flex items-center gap-2.5">
                      {e.advisor ? <Avatar name={e.advisor.fullName} size="sm" /> : null}
                      <div className="min-w-0">
                        {e.request ? (
                          <Link className="font-mono text-xs" href={requestHref(e.request.id)}>
                            {e.request.publicRef}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <div className="text-slate-500">{e.advisor?.fullName ?? ''}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="Detail" className="max-w-md text-xs whitespace-normal text-slate-700">
                    {e.detail}
                  </TableCell>
                  <TableCell data-label="Amount" className="font-medium whitespace-nowrap tabular-nums sm:text-right">
                    {e.amountInr !== null ? formatInr(e.amountInr) : '—'}
                  </TableCell>
                  <TableCell data-label="Resolution" className="text-xs">
                    {e.acknowledgeable && canAcknowledge ? <AcknowledgeException kind={e.kind} subjectId={e.subjectId} /> : <span className="text-slate-500">{e.resolvedVia ?? 'Admin/Accounts acknowledge'}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
