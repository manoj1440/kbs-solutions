import { formatDateTime, formatInr, payoutStateLabel } from '@kbs/shared';
import { Check, ChevronLeft, ChevronRight, Clock, Inbox, Minus, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { PayoutStateBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, MiniStat, PillNav } from '@/components/ui/kit';
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
const STATES = ['', 'PENDING_APPROVALS', 'APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'REJECTED', 'CANCELLED', 'ON_HOLD'];

/** F-603/F-604 → F-811 — payout requests with outstanding approvals; "awaiting me" shows the viewer's own queue. */
export async function PayoutRequestsList({ basePath, sp: rawSp, title, mode = 'approvals' }: { basePath: string; sp: { state?: string; awaitingMe?: string; page?: string; queue?: string }; title: string; mode?: 'approvals' | 'accounts' }) {
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
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pages = Math.max(1, Math.ceil(total / 50));
  const scope = total > r.data.length ? `of the ${r.data.length} shown` : 'in this view';
  const awaitingRole = (role: string) => r.data.filter((x) => x.outstanding.includes(role)).length;
  const corrections = r.data.filter((x) => x.correctionPending).length;
  const link = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) q.set(k, v);
    return `${basePath}?${q.toString()}`;
  };
  const active = sp.awaitingMe === 'true' ? `${basePath}?awaitingMe=true` : sp.queue === 'exceptions' ? `${basePath}?queue=exceptions` : `${basePath}${sp.state ? `?state=${sp.state}` : ''}`;
  const filters = mode === 'accounts' || sp.queue ? (
    <PillNav
      label="Payment queues"
      active={`${basePath}?queue=${sp.queue ?? 'awaiting'}`}
      items={[
        { href: `${basePath}?queue=awaiting`, label: `Awaiting payment (${queues?.awaiting.count ?? '…'})` },
        { href: `${basePath}?queue=paid`, label: `Paid (${queues?.paid.count ?? '…'})` },
        { href: `${basePath}?queue=exceptions`, label: `Exceptions (${queues?.exceptions.count ?? '…'})` },
      ]}
    />
  ) : (
    <>
      <PillNav
        label="My queues"
        active={active}
        items={[
          { href: `${basePath}?awaitingMe=true`, label: 'Awaiting my approval' },
          { href: `${basePath}?queue=exceptions`, label: `Payment exceptions${queues ? ` (${queues.exceptions.count})` : ''}` },
        ]}
      />
      <PillNav label="Payout request states" active={active} items={STATES.map((s) => ({ href: `${basePath}${s ? `?state=${s}` : ''}`, label: s ? payoutStateLabel(s) : 'All' }))} />
    </>
  );
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">{title}</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        {mode === 'accounts' ? (
          <>
            <MiniStat label="Awaiting payment" value={queues?.awaiting.count ?? '—'} hint={queues ? formatInr(queues.awaiting.amountInr) : 'unavailable'} tone="amber" />
            <MiniStat label="Paid" value={queues?.paid.count ?? '—'} hint={queues ? `${formatInr(queues.paid.confirmedTransferInr)} confirmed` : 'unavailable'} tone="emerald" />
            <MiniStat label="Exceptions" value={queues?.exceptions.count ?? '—'} hint={queues ? formatInr(queues.exceptions.amountInr) : 'unavailable'} tone="rose" />
            <MiniStat label="This page" value={total} hint="Matching this queue" tone="sky" />
          </>
        ) : (
          <>
            <MiniStat label="Requests" value={total} hint="Matching this queue" tone="sky" />
            <MiniStat label="Manager approval outstanding" value={awaitingRole('MANAGER')} hint={scope} tone={awaitingRole('MANAGER') ? 'amber' : 'slate'} />
            <MiniStat label="Admin approval outstanding" value={awaitingRole('ADMIN')} hint={scope} tone={awaitingRole('ADMIN') ? 'amber' : 'slate'} />
            <MiniStat label="Correction awaiting Admin" value={corrections} hint={scope} tone={corrections ? 'rose' : 'slate'} />
          </>
        )}
      </div>
      <section aria-label="Payout requests" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">{filters}</div>
        <div className="min-h-0 flex-1">
          {r.data.length === 0 ? (
            <EmptyState icon={Inbox} className="m-3" title="No requests." description="Nothing matches this queue right now." />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Request</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>{mode === 'accounts' ? 'Payment' : 'Approvals'}</TableHead>
                  <TableHead className="pr-4">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.data.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="pl-4" data-label="Request">
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
                    <TableCell className="pr-4 text-xs whitespace-nowrap text-slate-600" data-label="Submitted">
                      {formatDateTime(x.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-500 tabular-nums">
            {total ? `${((page - 1) * 50 + 1).toLocaleString('en-IN')}–${Math.min(page * 50, total).toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}` : '0 requests'} · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page - 1) })}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page + 1) })}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
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
