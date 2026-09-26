import { formatDateTime, formatInr, payoutStateLabel } from '@kbs/shared';
import { CalendarClock, CheckCircle2, Inbox, ListChecks, SearchCheck, ShieldAlert, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { PayoutStateBadge } from '@/components/status';
import { Avatar, BankMark, EmptyState, PageHeader, PillNav, SectionCard, StatCard, StatGrid, type Tone } from '@/components/ui/kit';
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
 * F-602 — entitlement ledger (REQ-17 §17.9: available = eligible − reserved − paid). Every row shows the exact bank
 * value, the rule version and the evidencing batch; the same figures serve Advisor, Manager, Admin and Accounts.
 */
export async function EntitlementsLedger({ basePath, leadHref, sp, title, description }: { basePath: string; leadHref: (leadId: string) => string; sp: { state?: string; bankId?: string; advisorId?: string; page?: string }; title: string; description: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const r = await apiFetch<EntitlementDto[]>(`/payouts/entitlements?${qs.toString()}`);
  const counts = r.meta.counts as LedgerCounts;
  const amounts = r.meta.amounts as Record<string, number>;
  const tiles: { label: string; count: number; amount?: number; icon: LucideIcon; tone: Tone }[] = [
    {
      label: 'Eligible (unique card events)',
      count: counts.eligible,
      icon: SearchCheck,
      tone: 'indigo',
    },
    {
      label: 'Available to claim',
      count: counts.availableToClaim,
      amount: amounts.available,
      icon: Wallet,
      tone: 'teal',
    },
    {
      label: 'Reserved in requests',
      count: counts.reserved,
      amount: amounts.reserved,
      icon: Inbox,
      tone: 'sky',
    },
    {
      label: 'Paid',
      count: counts.paid,
      amount: amounts.paid,
      icon: CheckCircle2,
      tone: 'emerald',
    },
    { label: 'Pending hold', count: counts.pendingHold, icon: CalendarClock, tone: 'slate' },
    {
      label: 'Under review (corrections)',
      count: counts.underReview,
      icon: ShieldAlert,
      tone: counts.underReview ? 'amber' : 'slate',
    },
  ];
  const total = Number(r.meta.total ?? 0);
  return (
    <div className="grid gap-6">
      <PageHeader icon={ListChecks} eyebrow={basePath.startsWith('/admin') ? 'Bank data & finance' : 'Team payouts'} title={title} description={description}>
        <StatGrid className="lg:grid-cols-3 xl:grid-cols-6">
          {tiles.map((x) => (
            <StatCard key={x.label} label={x.label} value={x.count} icon={x.icon} tone={x.tone} hint={x.amount !== undefined ? <span className="font-semibold text-slate-700 tabular-nums">{formatInr(x.amount)}</span> : 'Card events'} />
          ))}
        </StatGrid>
      </PageHeader>
      <PillNav
        label="Entitlement states"
        items={STATES.map((s) => ({
          href: `${basePath}${s ? `?state=${s}` : ''}`,
          label: s ? payoutStateLabel(s) : 'All',
        }))}
        active={`${basePath}${sp.state ? `?state=${sp.state}` : ''}`}
      />
      <SectionCard icon={ListChecks} tone="teal" title={`${total} entitlement(s)`} description="Created only by MIS evidence matching an approved bank rule; amounts are snapshotted at eligibility and never rewritten." flush={r.data.length > 0}>
        {r.data.length === 0 ? (
          <EmptyState icon={ListChecks} title="No entitlements." description="Entitlements appear once bank MIS evidence matches an approved payout rule." />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Bank / card</TableHead>
                <TableHead>Bank value (exact)</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Eligible at</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell data-label="State">
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
                  <TableCell data-label="Evidence" className="text-xs text-slate-600">
                    <span className="font-mono">{e.evidence.batchRef}</span> · {formatDateTime(e.evidence.uploadedAt)}
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
