import { formatInr, payoutStateLabel } from '@kbs/shared';

import { DataTablePanel } from '@/components/data-table';
import { EntitlementsTable, type EntitlementDto } from '@/components/entitlements-table';
import { MiniStat, PillNav, type Tone } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

export type { EntitlementDto } from '@/components/entitlements-table';
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
export async function EntitlementsLedger({ basePath, leadBase, sp, title }: { basePath: string; leadBase: string; sp: { state?: string; bankId?: string; advisorId?: string; page?: string }; title: string }) {
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
      <DataTablePanel
        label="Entitlements"
        toolbar={
          <PillNav
            label="Entitlement states"
            items={STATES.map((s) => ({
              href: `${basePath}${s ? `?state=${s}` : ''}`,
              label: s ? payoutStateLabel(s) : 'All',
            }))}
            active={`${basePath}${sp.state ? `?state=${sp.state}` : ''}`}
          />
        }
        footer={
          <div className="flex shrink-0 items-center border-t border-slate-100 px-4 py-2 text-xs text-slate-500 tabular-nums">
            {total.toLocaleString('en-IN')} entitlement{total === 1 ? '' : 's'} · page {page} of {pages}
          </div>
        }
      >
        <EntitlementsTable rows={r.data} leadBase={leadBase} />
      </DataTablePanel>
    </div>
  );
}
