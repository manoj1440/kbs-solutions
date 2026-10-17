import { formatInr, payoutStateLabel } from '@kbs/shared';
import { Filter } from 'lucide-react';
import Form from 'next/form';

import { DataTablePagination } from '@/components/data-table';
import { PayoutRequestsTable, type PayoutRequestRow } from '@/components/payout-requests-table';
import { Button } from '@/components/ui/button';
import { MiniStat, PillNav, selectClass, StatStrip } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

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
    apiFetch<PayoutRequestRow[]>(`/payouts/requests?${qs.toString()}`),
    mode === 'accounts' || sp.queue
      ? apiFetch<Queues>('/payouts/payments/queues')
          .then((x) => x.data)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const total = Number(r.meta.total ?? 0);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const scope = total > r.data.length ? `of the ${r.data.length} shown` : 'in this view';
  const awaitingRole = (role: string) => r.data.filter((x) => x.outstanding.includes(role)).length;
  const corrections = r.data.filter((x) => x.correctionPending).length;
  const link = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) q.set(k, v);
    return `${basePath}?${q.toString()}`;
  };
  // F-814 U7: one row — queues as tabs, request state as a filter of "All requests"
  const active = sp.awaitingMe === 'true' ? `${basePath}?awaitingMe=true` : sp.queue === 'exceptions' ? `${basePath}?queue=exceptions` : basePath;
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
        label="Payout request queues"
        active={active}
        items={[
          { href: `${basePath}?awaitingMe=true`, label: 'Awaiting my approval' },
          { href: basePath, label: 'All requests' },
          { href: `${basePath}?queue=exceptions`, label: `Payment exceptions${queues ? ` (${queues.exceptions.count})` : ''}` },
        ]}
      />
      {active === basePath ? (
        <Form action={basePath} className="ml-auto flex items-center gap-2">
          <select aria-label="Request state" name="state" defaultValue={sp.state ?? ''} className={cn(selectClass, 'h-9 min-w-48')}>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s ? payoutStateLabel(s) : 'Any state'}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-9">
            <Filter />
            Apply
          </Button>
        </Form>
      ) : null}
    </>
  );
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">{title}</h1>
      <StatStrip cols={4}>
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
      </StatStrip>
      <section aria-label="Payout requests" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle p-3">{filters}</div>
        <div className="min-h-0 flex-1">
          <PayoutRequestsTable rows={r.data} basePath={basePath} mode={mode} />
        </div>
        <DataTablePagination page={page} pageSize={50} total={total} href={(p) => link({ page: String(p) })} noun="requests" />
      </section>
    </div>
  );
}
