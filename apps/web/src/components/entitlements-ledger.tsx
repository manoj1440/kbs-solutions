import { formatDateTime, formatInr, payoutStateLabel } from '@kbs/shared';
import { ListChecks } from 'lucide-react';
import Link from 'next/link';

import { PayoutStateBadge } from '@/components/status';
import { Avatar, BankMark, EmptyState, MiniStat, PillNav, type Tone } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

export interface EntitlementDto {
  id: string;
  state: string;
  amountInr: number;
  eligibleAt: string;
  triggerField: string;
  triggerFieldValue: string;
  rule: { id: string; name: string; version: number };
  lead: { id: string; publicRef: string; customerFullName: string };
  advisor: { id: string; fullName: string };
  bank: { code: string; displayName: string };
  card: string;
  evidence: { batchRef: string; uploadedAt: string };
  reviewReason: string | null;
  currentRequestId: string | null;
  createdAt: string;
}
export interface LedgerCounts {
  pendingHold: number;
  available: number;
  reserved: number;
  paid: number;
  underReview: number;
  void: number;
  eligible: number;
  availableToClaim: number;
}
const STATES = ['', 'PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED', 'PAID', 'UNDER_REVIEW', 'VOID'];

/**
 * F-602 → F-811 — entitlement ledger (REQ-17 §17.9: available = eligible − reserved − paid). Every row shows the exact
 * bank value, the rule version and the evidencing batch; the same figures serve Advisor, Manager, Admin and Accounts.
 */
export async function EntitlementsLedger({ basePath, leadHref, sp, title }: { basePath: string; leadHref: (leadId: string) => string; sp: { state?: string; bankId?: string; advisorId?: string; page?: string }; title: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const r = await apiFetch<EntitlementDto[]>(`/payouts/entitlements?${qs.toString()}`);
  const counts = r.meta.counts as LedgerCounts;
  const amounts = r.meta.amounts as Record<string, number>;
  const tiles: { label: string; count: number; amount?: number; tone: Tone }[] = [
    { label: 'Eligible card events', count: counts.eligible, tone: 'indigo' },
    { label: 'Available to claim', count: counts.availableToClaim, amount: amounts.available, tone: 'teal' },
    { label: 'Reserved in requests', count: counts.reserved, amount: amounts.reserved, tone: 'sky' },
    { label: 'Paid', count: counts.paid, amount: amounts.paid, tone: 'emerald' },
    { label: 'Pending hold', count: counts.pendingHold, tone: 'slate' },
    { label: 'Under review', count: counts.underReview, tone: counts.underReview ? 'amber' : 'slate' },
  ];
  const total = Number(r.meta.total ?? 0);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pages = Math.max(1, Math.ceil(total / 50));
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">{title}</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((x) => (
          <MiniStat key={x.label} label={x.label} value={x.count} hint={x.amount !== undefined ? formatInr(x.amount) : 'card events'} tone={x.tone} />
        ))}
      </div>
      <section aria-label="Entitlements" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <PillNav
            label="Entitlement states"
            items={STATES.map((s) => ({
              href: `${basePath}${s ? `?state=${s}` : ''}`,
              label: s ? payoutStateLabel(s) : 'All',
            }))}
            active={`${basePath}${sp.state ? `?state=${sp.state}` : ''}`}
          />
        </div>
        <div className="min-h-0 flex-1">
          {r.data.length === 0 ? (
            <EmptyState icon={ListChecks} className="m-3" title="No entitlements." description="Entitlements appear once bank MIS evidence matches an approved payout rule." />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">State</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Bank / card</TableHead>
                  <TableHead>Bank value (exact)</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Eligible at</TableHead>
                  <TableHead className="pr-4">Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-4" data-label="State">
                      <PayoutStateBadge state={e.state} />
                      {e.reviewReason ? <div className="mt-1 max-w-56 text-[11px] whitespace-normal text-slate-500">{e.reviewReason}</div> : null}
                    </TableCell>
                    <TableCell data-label="Lead" className="whitespace-nowrap">
                      <Link className="font-mono text-xs font-semibold" href={leadHref(e.lead.id)}>
                        {e.lead.publicRef}
                      </Link>
                      <div className="text-[11px] text-slate-500">{e.lead.customerFullName}</div>
                    </TableCell>
                    <TableCell data-label="Advisor">
                      <div className="flex items-center gap-2">
                        <Avatar name={e.advisor.fullName} size="sm" />
                        <span className="whitespace-nowrap text-slate-800">{e.advisor.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell data-label="Bank / card" className="text-xs">
                      <div className="flex items-center gap-2">
                        <BankMark code={e.bank.code} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800">{e.bank.displayName}</div>
                          <div className="text-[11px] text-slate-500">{e.card}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-label="Bank value (exact)" className="text-xs">
                      <code>{e.triggerField}</code> = “{e.triggerFieldValue}”
                    </TableCell>
                    <TableCell data-label="Rule" className="text-xs">
                      {e.rule.name} <span className="text-slate-500">v{e.rule.version}</span>
                    </TableCell>
                    <TableCell data-label="Amount" className="font-semibold whitespace-nowrap text-slate-900 tabular-nums sm:text-right">
                      {formatInr(e.amountInr)}
                    </TableCell>
                    <TableCell data-label="Eligible at" className="text-xs text-slate-600">
                      {formatDateTime(e.eligibleAt)}
                    </TableCell>
                    <TableCell className="pr-4 text-xs text-slate-600" data-label="Evidence">
                      <span className="font-mono">{e.evidence.batchRef}</span> · {formatDateTime(e.evidence.uploadedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 items-center border-t border-slate-100 px-4 py-2 text-xs text-slate-500 tabular-nums">
          {total.toLocaleString('en-IN')} entitlement{total === 1 ? '' : 's'} · page {page} of {pages}
        </div>
      </section>
    </div>
  );
}
