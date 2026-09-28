'use client';

import { formatInr } from '@kbs/shared';
import { CreditCard, UserCog, UserRound, Users } from 'lucide-react';

import { BankCell, columnHelper, DataTable, PersonCell } from '@/components/data-table';
import { EmptyState, Meter } from '@/components/ui/kit';

export interface M {
  value: number;
  amountInr?: number;
  denominator?: { label: string; value: number };
}
export interface Dist {
  buckets: { value: string; count: number }[];
}
export interface Person {
  id: string;
  fullName: string;
  publicRef: string;
  status: string;
}
export interface TelecallerRow {
  user: Person;
  records: Record<string, M>;
  calls: Record<string, M>;
  callbacks: Record<string, M>;
  shares: { total: M };
}
export interface ManagerRow {
  user: Person;
  telecallers: number;
  advisors: number;
  calls: Record<string, M>;
  shares: M;
  leads: Record<string, M>;
  payouts: Record<string, M>;
}
export interface AdvisorRow {
  user: Person;
  leads: Record<string, M>;
  decision: Dist;
  activation: Dist;
  payouts: Record<string, M>;
}
export interface BankCardMixRow {
  bank: { code: string; displayName: string };
  card: { id: string; name: string };
  leads: number;
  misMatched: number;
  awaitingMis: number;
  payoutEligible: { count: number; amountInr: number };
  payoutPaid: { count: number; amountInr: number };
}

const pct = (m: M) => (m.denominator && m.denominator.value ? ` (${Math.round((m.value / m.denominator.value) * 100)}%)` : '');

/** Count with its ₹ amount (payout events). */
function Money({ count, amount }: { count: number; amount: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-slate-900">{count}</span>
      <span className="text-slate-400"> · </span>
      <span className="text-slate-600">{formatInr(amount)}</span>
    </span>
  );
}

/** Top bank values with counts — verbatim text, neutral chips (never recoloured). */
function TopValues({ x }: { x: Dist }) {
  const top = x.buckets.slice(0, 3);
  if (!top.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {top.map((b) => (
        <span key={b.value} className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11.5px] text-slate-700 ring-1 ring-slate-200 ring-inset">
          <span className="min-w-0 break-words">{b.value}</span>
          <span className="font-semibold text-slate-900 tabular-nums">{b.count}</span>
        </span>
      ))}
    </div>
  );
}

const t = columnHelper<TelecallerRow>();
const telecallerColumns = t.columns([
  t.accessor((r) => r.user.fullName, {
    id: 'telecaller',
    header: 'Telecaller',
    cell: ({ row }) => <PersonCell name={row.original.user.fullName} href={`/admin/calling-list/performance/telecaller/${row.original.user.id}`} status={row.original.user.status} />,
  }),
  t.accessor((r) => r.records.assigned.value, {
    id: 'records',
    header: 'Records (assigned / active)',
    meta: { label: 'Records', align: 'right' },
    cell: ({ row }) => `${row.original.records.assigned.value} / ${row.original.records.active.value}`,
  }),
  t.accessor((r) => r.calls.attempts.value, {
    id: 'attempts',
    header: 'Attempts',
    meta: { align: 'right' },
  }),
  t.accessor((r) => r.calls.connected.value, {
    id: 'connected',
    header: 'Connected',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <>
        <span className="font-medium text-slate-900">{row.original.calls.connected.value}</span>
        <span className="text-xs text-slate-500">{pct(row.original.calls.connected)}</span>
        {row.original.calls.connected.denominator?.value ? <Meter value={row.original.calls.connected.value} max={row.original.calls.connected.denominator.value} tone="emerald" className="mt-1 h-1 w-16 sm:ml-auto" label="Connected share of attempts" /> : null}
      </>
    ),
  }),
  t.accessor((r) => r.calls.notAnswered.value, {
    id: 'notAnswered',
    header: 'Not answered',
    meta: { align: 'right' },
  }),
  t.accessor((r) => r.calls.uniqueCustomersContacted.value, {
    id: 'uniqueContacted',
    header: 'Unique contacted',
    meta: { align: 'right' },
  }),
  t.accessor((r) => r.calls.recordingsAvailable.value, {
    id: 'recordings',
    header: 'Recordings',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <>
        {row.original.calls.recordingsAvailable.value}
        <span className="text-xs text-slate-500">{pct(row.original.calls.recordingsAvailable)}</span>
      </>
    ),
  }),
  t.accessor((r) => r.callbacks.due.value, {
    id: 'callbacks',
    header: 'Callbacks due / done',
    meta: { label: 'Callbacks', align: 'right' },
    cell: ({ row }) => `${row.original.callbacks.due.value} / ${row.original.callbacks.completed.value}`,
  }),
  t.accessor((r) => r.shares.total.value, {
    id: 'shares',
    header: 'Shares',
    meta: { align: 'right' },
  }),
]);

export function TelecallerPerformanceTable({ rows }: { rows: TelecallerRow[] }) {
  return (
    <DataTable
      variant="panel"
      columns={telecallerColumns}
      data={rows}
      getRowId={(r) => r.user.id}
      viewOptions
      empty={<EmptyState icon={Users} title="No Telecallers." />}
    />
  );
}

const m = columnHelper<ManagerRow>();
const managerColumns = m.columns([
  m.accessor((r) => r.user.fullName, {
    id: 'manager',
    header: 'Manager',
    cell: ({ row }) => <PersonCell name={row.original.user.fullName} href={`/admin/dashboards/advisors?managerId=${row.original.user.id}`} />,
  }),
  m.accessor((r) => r.telecallers, {
    id: 'team',
    header: 'Team',
    meta: { cellClassName: 'text-slate-600' },
    cell: ({ row }) => (
      <>
        <span className="tabular-nums">{row.original.telecallers}</span> Telecallers · <span className="tabular-nums">{row.original.advisors}</span> Advisors
      </>
    ),
  }),
  m.accessor((r) => r.calls.attempts.value, {
    id: 'calls',
    header: 'Attempts / connected',
    meta: { align: 'right' },
    cell: ({ row }) => `${row.original.calls.attempts.value} / ${row.original.calls.connected.value}`,
  }),
  m.accessor((r) => r.shares.value, {
    id: 'shares',
    header: 'Shares',
    meta: { align: 'right' },
  }),
  m.accessor((r) => r.leads.created.value, {
    id: 'leads',
    header: 'Leads / MIS matched',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <>
        {row.original.leads.created.value} / {row.original.leads.misMatched.value}
        {row.original.leads.created.value ? <Meter value={row.original.leads.misMatched.value} max={row.original.leads.created.value} tone="indigo" className="mt-1 h-1 w-16 sm:ml-auto" label="MIS matched share of leads" /> : null}
      </>
    ),
  }),
  m.accessor((r) => r.payouts.eligible.value, {
    id: 'eligible',
    header: 'Payout eligible',
    meta: { align: 'right' },
    cell: ({ row }) => <Money count={row.original.payouts.eligible.value} amount={row.original.payouts.eligible.amountInr ?? 0} />,
  }),
  m.accessor((r) => r.payouts.approvedUnpaid.value, {
    id: 'unpaid',
    header: 'Approved unpaid',
    meta: { align: 'right' },
    cell: ({ row }) => <Money count={row.original.payouts.approvedUnpaid.value} amount={row.original.payouts.approvedUnpaid.amountInr ?? 0} />,
  }),
  m.accessor((r) => r.payouts.paid.value, {
    id: 'paid',
    header: 'Paid',
    meta: { align: 'right' },
    cell: ({ row }) => <Money count={row.original.payouts.paid.value} amount={row.original.payouts.paid.amountInr ?? 0} />,
  }),
]);

export function ManagerPerformanceTable({ rows }: { rows: ManagerRow[] }) {
  return (
    <DataTable
      variant="panel"
      columns={managerColumns}
      data={rows}
      getRowId={(r) => r.user.id}
      viewOptions
      empty={<EmptyState icon={UserCog} title="No Managers." />}
    />
  );
}

const a = columnHelper<AdvisorRow>();
const advisorColumns = a.columns([
  a.accessor((r) => r.user.fullName, {
    id: 'advisor',
    header: 'Advisor',
    cell: ({ row }) => <PersonCell name={row.original.user.fullName} href={`/admin/leads?advisorId=${row.original.user.id}`} status={row.original.user.status} />,
  }),
  a.accessor((r) => r.leads.created.value, {
    id: 'leads',
    header: 'Leads / matched',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <>
        {row.original.leads.created.value} / {row.original.leads.misMatched.value}
        {row.original.leads.created.value ? <Meter value={row.original.leads.misMatched.value} max={row.original.leads.created.value} tone="indigo" className="mt-1 h-1 w-16 sm:ml-auto" label="MIS matched share of leads" /> : null}
      </>
    ),
  }),
  a.display({
    id: 'decision',
    header: 'Final decision',
    cell: ({ row }) => <TopValues x={row.original.decision} />,
  }),
  a.display({
    id: 'activation',
    header: 'Card activation',
    cell: ({ row }) => <TopValues x={row.original.activation} />,
  }),
  a.accessor((r) => r.payouts.eligible.value, {
    id: 'eligible',
    header: 'Eligible',
    meta: { align: 'right' },
    cell: ({ row }) => <Money count={row.original.payouts.eligible.value} amount={row.original.payouts.eligible.amountInr ?? 0} />,
  }),
  a.accessor((r) => r.payouts.paid.value, {
    id: 'paid',
    header: 'Paid',
    meta: { align: 'right' },
    cell: ({ row }) => <Money count={row.original.payouts.paid.value} amount={row.original.payouts.paid.amountInr ?? 0} />,
  }),
]);

export function AdvisorPerformanceTable({ rows }: { rows: AdvisorRow[] }) {
  return (
    <DataTable
      variant="panel"
      columns={advisorColumns}
      data={rows}
      getRowId={(r) => r.user.id}
      viewOptions
      empty={<EmptyState icon={UserRound} title="No Advisors." />}
    />
  );
}

const b = columnHelper<BankCardMixRow>();
const mixColumns = b.columns([
  b.accessor((r) => r.bank.displayName, {
    id: 'bank',
    header: 'Bank',
    cell: ({ row }) => <BankCell code={row.original.bank.code} name={row.original.bank.displayName} />,
  }),
  b.accessor((r) => r.card.name, {
    id: 'card',
    header: 'Card',
  }),
  b.accessor('leads', {
    header: 'Leads',
    meta: { align: 'right' },
  }),
  b.accessor('misMatched', {
    header: 'MIS matched',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <>
        {row.original.misMatched}
        {row.original.leads ? <Meter value={row.original.misMatched} max={row.original.leads} tone="indigo" className="mt-1 h-1 w-16 sm:ml-auto" label="MIS matched share of leads" /> : null}
      </>
    ),
  }),
  b.accessor('awaitingMis', {
    header: 'Awaiting MIS',
    meta: { align: 'right' },
  }),
  b.accessor((r) => r.payoutEligible.count, {
    id: 'eligible',
    header: 'Payout eligible',
    meta: { align: 'right' },
    cell: ({ row }) => <Money count={row.original.payoutEligible.count} amount={row.original.payoutEligible.amountInr} />,
  }),
  b.accessor((r) => r.payoutPaid.count, {
    id: 'paid',
    header: 'Paid',
    meta: { align: 'right' },
    cell: ({ row }) => <Money count={row.original.payoutPaid.count} amount={row.original.payoutPaid.amountInr} />,
  }),
]);

export function BankCardMixTable({ rows }: { rows: BankCardMixRow[] }) {
  return (
    <DataTable
      variant="panel"
      columns={mixColumns}
      data={rows}
      getRowId={(r) => `${r.bank.code}:${r.card.id}`}
      viewOptions
      empty={<EmptyState icon={CreditCard} title="No leads in this period." />}
    />
  );
}
