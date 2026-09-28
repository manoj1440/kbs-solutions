import { formatDate, formatDateTime, type PayoutRuleView } from '@kbs/shared';
import { CalendarRange, Hourglass, Settings2 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { BankMark, EmptyState, humanize, MiniStat } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { NewRule } from './new-rule';

export const metadata = { title: 'Payout rules · KBS Solutions' };

interface Bank {
  id: string;
  code: string;
  displayName: string;
}
const STATUS: Record<string, 'success' | 'warning' | 'unknown'> = {
  APPROVED: 'success',
  DRAFT: 'warning',
  RETIRED: 'unknown',
};

/** F-601 → F-811 Admin: payout rules per bank (versioned) — no rule means nothing is ever eligible (PAY-01). */
export default async function PayoutRulesPage() {
  const [rules, banks] = await Promise.all([apiFetch<PayoutRuleView[]>('/payouts/rules'), apiFetch<Bank[]>('/catalogue/banks')]);
  const approvedBanks = new Set(rules.data.filter((r) => r.status === 'APPROVED').map((r) => r.bank.id));
  const approved = rules.data.filter((r) => r.status === 'APPROVED').length;
  const drafts = rules.data.filter((r) => r.status === 'DRAFT').length;
  const uncovered = banks.data.filter((b) => !approvedBanks.has(b.id)).length;
  const latestApproval = formatDateTime(rules.data.map((r) => r.approvedAt).filter(Boolean).sort().at(-1) ?? null) || null;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Payout rules</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Rules" value={rules.data.length} hint="All versions kept" tone="sky" />
        <MiniStat label="Approved" value={approved} hint="In force for eligibility" tone="emerald" />
        <MiniStat label="Drafts" value={drafts} hint="Need an approved rate" tone={drafts ? 'amber' : 'slate'} />
        <MiniStat label="Banks without a rule" value={uncovered} hint={`of ${banks.data.length} — never eligible`} tone={uncovered ? 'rose' : 'slate'} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-2 pb-3">
          {banks.data.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white py-1 pr-2 pl-1 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
              <BankMark code={b.code} size="sm" />
              <Badge variant={approvedBanks.has(b.id) ? 'success' : 'unknown'}>{b.code} {approvedBanks.has(b.id) ? 'rule approved' : 'no approved rule'}</Badge>
            </span>
          ))}
        </div>
        <section aria-label="Payout rules" className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          {rules.data.length === 0 ? (
            <EmptyState icon={Settings2} className="m-3" title="No payout rules yet — nothing is eligible until one is approved." description="Create a draft below, add a rate, approve the rate, then approve the rule." />
          ) : (
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {rules.data.map((r) => (
                <article key={r.id} className="lift relative flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <BankMark code={r.bank.code} />
                      <div className="min-w-0">
                        <div className="text-[11.5px] text-slate-500">{r.bank.displayName}</div>
                        <Link className="line-clamp-2 block font-semibold break-words text-slate-900 after:absolute after:inset-0 after:rounded-xl hover:text-teal-700" href={`/admin/payouts/rules/${r.id}`}>
                          {r.name}
                        </Link>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={STATUS[r.status] ?? 'secondary'}>{humanize(r.status)}</Badge>
                      <span className="text-[11px] font-semibold text-slate-500 tabular-nums">v{r.version}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs break-words text-slate-700">
                    <div className="mb-1 text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Trigger</div>
                    <code>{r.triggerField}</code> ∈ {r.triggerValues.map((v) => `“${v}”`).join(', ')}
                    {r.productCodePattern ? ` · product /${r.productCodePattern}/` : ''}
                  </div>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Current rate</div>
                      <div className="text-lg font-semibold text-slate-900 tabular-nums">{r.currentRate ? `₹${r.currentRate.amountInr.toLocaleString('en-IN')}` : <span className="text-sm font-normal text-slate-500">none approved</span>}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Entitlements</div>
                      <div className="text-lg font-semibold text-slate-900 tabular-nums">{r.entitlementCount}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Hourglass className="size-3.5 text-slate-400" aria-hidden="true" />
                      Hold {r.holdDays} d
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarRange className="size-3.5 text-slate-400" aria-hidden="true" />
                      {formatDate(r.effectiveFrom)} → {r.effectiveTo ? formatDate(r.effectiveTo) : 'open'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
          {rules.data.length && latestApproval ? <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Latest approval {latestApproval} · approvals are audited with a reason</p> : null}
        </section>
        <div className="pt-3">
          <NewRule banks={banks.data} />
        </div>
      </div>
    </div>
  );
}
