import { formatDateTime, formatInr, payoutStateLabel } from '@kbs/shared';
import { AlertTriangle, Check, CheckCircle2, Clock, Inbox, Minus, UserCheck, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { PayoutStateBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize, IconTile, PageHeader, PillNav, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  publicRef: string;
  state: string;
  advisor: { id: string; fullName: string };
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  approvals: { role: string; decision: string; at: string }[];
  outstanding: string[];
  payment: { state: string; paidAt: string; amountInr: number } | null;
  holdReason: string | null;
  paidAt: string | null;
  correctionPending: boolean;
}
interface Queues {
  awaiting: { count: number; amountInr: number };
  paid: { count: number; amountInr: number; confirmedTransferInr: number };
  exceptions: { count: number; amountInr: number };
  asOf: string;
}
const QUEUES = [
  { key: 'awaiting', label: 'Awaiting payment', icon: Clock, tone: 'amber' },
  { key: 'paid', label: 'Paid', icon: CheckCircle2, tone: 'emerald' },
  { key: 'exceptions', label: 'Exceptions / needs correction', icon: AlertTriangle, tone: 'rose' },
] as const;
const STATES = ['', 'PENDING_APPROVALS', 'APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'REJECTED', 'CANCELLED', 'ON_HOLD'];

/** F-603/F-604 — payout requests with outstanding approvals; "awaiting me" shows the viewer's own queue. */
export async function PayoutRequestsList({ basePath, sp: rawSp, title, description, mode = 'approvals' }: { basePath: string; sp: { state?: string; awaitingMe?: string; page?: string; queue?: string }; title: string; description: string; mode?: 'approvals' | 'accounts' }) {
  const qs = new URLSearchParams();
  const sp = mode === 'accounts' && !rawSp.queue && !rawSp.state ? { ...rawSp, queue: 'awaiting' } : rawSp;
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const [r, queues] = await Promise.all([
    apiFetch<Row[]>(`/payouts/requests?${qs.toString()}`),
    mode === 'accounts' || sp.queue
      ? apiFetch<Queues>('/payouts/payments/queues')
          .then((x) => x.data)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const total = Number(r.meta.total ?? 0);
  const scope = total > r.data.length ? `Of the ${r.data.length} shown` : 'In this view';
  const awaitingRole = (role: string) => r.data.filter((x) => x.outstanding.includes(role)).length;
  const corrections = r.data.filter((x) => x.correctionPending).length;
  const queueItems = [
    { href: `${basePath}?awaitingMe=true`, label: 'Awaiting my approval', icon: UserCheck },
    {
      href: `${basePath}?queue=exceptions`,
      label: 'Payment exceptions',
      icon: AlertTriangle,
      count: queues?.exceptions.count,
    },
  ];
  const stateItems = STATES.map((s) => ({
    href: `${basePath}${s ? `?state=${s}` : ''}`,
    label: s ? payoutStateLabel(s) : 'All',
  }));
  const active = sp.awaitingMe === 'true' ? `${basePath}?awaitingMe=true` : sp.queue === 'exceptions' ? `${basePath}?queue=exceptions` : `${basePath}${sp.state ? `?state=${sp.state}` : ''}`;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={sp.queue === 'exceptions' && mode !== 'accounts' ? AlertTriangle : Wallet}
        tone={sp.queue === 'exceptions' && mode !== 'accounts' ? 'rose' : 'teal'}
        eyebrow={basePath.startsWith('/admin') ? 'Bank data & finance' : mode === 'accounts' ? 'Accounts' : 'Team payouts'}
        title={title}
        description={description}
      >
        {mode === 'accounts' ? (
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {QUEUES.map((q) => {
              const on = sp.queue === q.key;
              return (
                <Link
                  key={q.key}
                  href={`${basePath}?queue=${q.key}`}
                  prefetch={false}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'lift group min-w-0 rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:p-5',
                    on ? 'border-teal-600 ring-2 ring-teal-600/15' : 'border-slate-200/80 hover:border-slate-300',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[12.5px] font-medium text-slate-600">{q.label}</span>
                    <IconTile icon={q.icon} tone={q.tone} size="sm" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-[28px] sm:leading-9">{queues ? queues[q.key].count : '—'}</div>
                  <div className="mt-1 text-xs text-slate-500 tabular-nums">{queues ? (q.key === 'paid' ? `${formatInr(queues.paid.confirmedTransferInr)} confirmed transfers` : formatInr(queues[q.key].amountInr)) : 'unavailable'}</div>
                </Link>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-start gap-2">
              <PillNav label="My queues" items={queueItems} active={active} className="max-w-full min-w-0" />
              <PillNav label="Payout request states" items={stateItems} active={active} className="max-w-full min-w-0" />
            </div>
            {r.data.length ? (
              <StatGrid>
                <StatCard label="Requests" value={total} hint="Matching this queue" icon={Inbox} tone="teal" />
                <StatCard label="Manager approval outstanding" value={awaitingRole('MANAGER')} hint={scope} icon={Users} tone={awaitingRole('MANAGER') ? 'amber' : 'slate'} />
                <StatCard label="Admin approval outstanding" value={awaitingRole('ADMIN')} hint={scope} icon={UserCheck} tone={awaitingRole('ADMIN') ? 'amber' : 'slate'} />
                <StatCard label="Correction awaiting Admin" value={corrections} hint={scope} icon={AlertTriangle} tone={corrections ? 'rose' : 'slate'} />
              </StatGrid>
            ) : null}
          </>
        )}
      </PageHeader>
      <SectionCard
        icon={mode === 'accounts' ? Wallet : Inbox}
        tone={mode === 'accounts' ? 'emerald' : 'teal'}
        title={`${total} request(s)`}
        description={mode === 'accounts' ? 'Only requests approved by both the Manager and the Admin reach Accounts. Pay outside KBS, then record the transfer.' : 'A submitted request is not an approval; Accounts sees a request only after both approvals.'}
        flush={r.data.length > 0}
      >
        {r.data.length === 0 ? (
          <EmptyState icon={Inbox} title="No requests." description="Nothing matches this queue right now." />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>State</TableHead>
                <TableHead>{mode === 'accounts' ? 'Payment' : 'Approvals'}</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data.map((x) => (
                <TableRow key={x.id}>
                  <TableCell data-label="Request">
                    <Link className="font-mono text-xs font-semibold" href={`${basePath}/${x.id}`}>
                      {x.publicRef}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-slate-500">{x.itemCount} card event(s)</div>
                  </TableCell>
                  <TableCell data-label="Advisor">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={x.advisor.fullName} size="sm" />
                      <span className="font-medium text-slate-800">{x.advisor.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell data-label="Amount" className="text-[15px] font-semibold whitespace-nowrap text-slate-900 tabular-nums sm:text-right">
                    {formatInr(x.totalAmountInr)}
                  </TableCell>
                  <TableCell data-label="State">
                    <PayoutStateBadge state={x.state} />
                  </TableCell>
                  {mode === 'accounts' ? (
                    <TableCell data-label="Payment" className="text-xs">
                      {x.payment ? (
                        <span className="text-slate-700">
                          {humanize(x.payment.state)} · <span className="tabular-nums">{formatInr(x.payment.amountInr)}</span>
                        </span>
                      ) : x.state === 'APPROVED' ? (
                        <span className="text-slate-500">Not yet recorded</span>
                      ) : (
                        '—'
                      )}
                      {x.correctionPending ? (
                        <Badge variant="warning" className="ml-1">
                          correction awaiting Admin
                        </Badge>
                      ) : null}
                      {x.holdReason ? <div className="text-destructive mt-1 whitespace-normal">{x.holdReason}</div> : null}
                    </TableCell>
                  ) : (
                    <TableCell data-label="Approvals" className="text-xs">
                      <ApprovalSteps row={x} />
                      {x.payment ? <div className="mt-1.5 text-[11px] text-slate-500">Payment {humanize(x.payment.state).toLowerCase()}</div> : null}
                      {x.correctionPending ? (
                        <Badge variant="warning" className="mt-1.5">
                          correction awaiting Admin
                        </Badge>
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell data-label="Submitted" className="text-xs whitespace-nowrap text-slate-600">
                    {formatDateTime(x.submittedAt)}
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

const STEP: Record<'approved' | 'rejected' | 'pending' | 'none', { icon: LucideIcon; cls: string; text: string }> = {
  approved: { icon: Check, cls: 'bg-emerald-500 text-white', text: 'approved' },
  rejected: { icon: X, cls: 'bg-rose-500 text-white', text: 'rejected' },
  pending: {
    icon: Clock,
    cls: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-300',
    text: 'pending',
  },
  none: { icon: Minus, cls: 'bg-slate-100 text-slate-400', text: '—' },
};

/** Two-step approval trail (Manager → Admin) built from the row's approval records; text is always rendered. */
function ApprovalSteps({ row }: { row: Row }) {
  const steps = (['MANAGER', 'ADMIN'] as const).map((role) => {
    const a = row.approvals.find((x) => x.role === role);
    const status: keyof typeof STEP = a ? (a.decision === 'APPROVED' ? 'approved' : 'rejected') : row.outstanding.includes(role) ? 'pending' : 'none';
    return { role, status };
  });
  return (
    <ol className="flex items-center gap-1.5" aria-label="Approvals">
      {steps.map(({ role, status }, i) => {
        const s = STEP[status];
        return (
          <li key={role} className="flex items-center gap-1.5">
            {i > 0 ? <span className={cn('h-px w-3 sm:w-4', steps[0].status === 'approved' ? 'bg-emerald-300' : 'bg-slate-200')} aria-hidden="true" /> : null}
            <span className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full', s.cls)} aria-hidden="true">
              <s.icon className="size-3" strokeWidth={3} />
            </span>
            <span className="leading-tight">
              <span className="block text-[12px] font-medium text-slate-800">{humanize(role)}</span>
              <span className="block text-[10.5px] text-slate-500">{s.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
