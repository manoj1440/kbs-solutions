import { formatDateTime, formatInr } from '@kbs/shared';
import { AlertTriangle } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { type ExceptionItem, PayoutExceptionsTable } from '@/components/payout-exceptions-table';
import { Button } from '@/components/ui/button';
import { Callout, Meter, MiniStat, selectClass, TONE, type Tone } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tot = { count: number; amountInr: number };
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

/**
 * F-606 → F-811 payout liability & reconciliation. Same ledger (and bucket classifier) as the Advisor ledger, so figures
 * reconcile across roles. Date basis is always shown. Approval is not payment; paid = confirmed transfers.
 */
export async function PayoutDashboard({ basePath, requestBase, sp, title, canAcknowledge }: { basePath: string; requestBase: string; sp: Record<string, string | undefined>; title: string; canAcknowledge: boolean }) {
  const qs = new URLSearchParams();
  for (const k of ['from', 'to', 'dateBasis', 'bankId', 'advisorId', 'managerId']) if (sp[k]) qs.set(k, sp[k] as string);
  const [d, banks] = await Promise.all([
    apiFetch<Dashboard>(`/dashboards/payouts?${qs.toString()}`).then((r) => r.data),
    apiFetch<Bank[]>('/catalogue/banks')
      .then((r) => r.data)
      .catch(() => [] as Bank[]),
  ]);
  const t = d.totals;
  const tiles: { label: string; tot: Tot; hint: string; color: Tone; inEligible?: boolean }[] = [
    { label: 'Eligible card events', tot: t.eligible, hint: 'MIS-evidenced under approved rules', color: 'indigo' },
    { label: 'Available to claim', tot: t.available, hint: 'not reserved or paid', color: 'teal', inEligible: true },
    { label: 'Requested', tot: t.requested, hint: 'awaiting approvals', color: 'sky', inEligible: true },
    { label: 'Approved, unpaid', tot: t.approvedUnpaid, hint: 'Accounts payment pending', color: 'violet', inEligible: true },
    { label: 'On hold', tot: t.onHold, hint: 'held for Admin review', color: t.onHold.count ? 'amber' : 'slate', inEligible: true },
    { label: 'Paid (events)', tot: t.paid, hint: 'paid for this event', color: 'emerald', inEligible: true },
    { label: 'Pending hold period', tot: t.pendingHold, hint: 'hold days not elapsed', color: 'slate', inEligible: true },
    { label: 'Under review', tot: t.underReview, hint: 'MIS no longer reports the trigger', color: t.underReview.count ? 'amber' : 'slate' },
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
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">{title}</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {tiles.map((x) => (
          <MiniStat
            key={x.label}
            label={x.label}
            value={x.tot.count}
            hint={`${formatInr(x.tot.amountInr)} · ${x.hint}`}
            tone={x.color}
          />
        ))}
      </div>
      <Form className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgb(15_23_42/4%)]" action={basePath}>
        <input aria-label="From date" type="date" name="from" defaultValue={sp.from ?? ''} className={cn(selectClass, 'h-9 w-36')} />
        <input aria-label="To date" type="date" name="to" defaultValue={sp.to ?? ''} className={cn(selectClass, 'h-9 w-36')} />
        <select aria-label="Date basis" className={cn(selectClass, 'h-9 min-w-44')} name="dateBasis" defaultValue={sp.dateBasis ?? 'eligibleAt'}>
          {Object.entries(BASIS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Bank" className={cn(selectClass, 'h-9 min-w-32')} name="bankId" defaultValue={sp.bankId ?? ''}>
          <option value="">All banks</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="h-9">
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href={basePath}>Reset</Link>
        </Button>
        <span className="ml-auto text-[11px] text-slate-500">
          as of {formatDateTime(d.meta.asOf)} · {d.meta.source}
        </span>
      </Form>
      {d.exceptions.total > 0 ? (
        <Callout role="alert" tone="warning" icon={AlertTriangle} className="shrink-0">
          {d.exceptions.total} open payout exception(s):{' '}
          {Object.entries(d.exceptions.byKind)
            .map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`)
            .join(' · ')}
        </Callout>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:overflow-visible">
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <section aria-label="Where the eligible value sits" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
            <div className="grid gap-3">
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
          </section>
          <div className="grid gap-3">
            <section aria-label="Confirmed transfers" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
              <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{formatInr(d.confirmedTransfers.amountInr)}</div>
              <div className="mt-1 text-xs text-slate-600">
                Confirmed transfers · {d.confirmedTransfers.count} paid request(s) · {d.missingProof} recorded without proof
              </div>
            </section>
            <section aria-label="Dual-approval backlog" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
              <div className="mb-3 text-xs text-slate-600">
                Dual-approval backlog: <span className="font-semibold text-slate-800 tabular-nums">{d.approvals.pendingCount}</span> request(s) · {formatInr(d.approvals.pendingAmountInr)} · Manager {d.approvals.awaitingManager} · Admin {d.approvals.awaitingAdmin}
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
            </section>
          </div>
        </div>
        <section aria-label="Exceptions" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Exceptions · derived from the ledger — nothing here claws back or refunds money
          </div>
          <div className="min-h-0 flex-1">
            <PayoutExceptionsTable rows={d.exceptions.items} requestBase={requestBase} canAcknowledge={canAcknowledge} />
          </div>
        </section>
      </div>
    </div>
  );
}
