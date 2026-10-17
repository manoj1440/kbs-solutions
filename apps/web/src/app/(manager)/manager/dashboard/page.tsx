import { formatInr, type PendingAction } from '@kbs/shared';
import { BadgeCheck, CalendarClock, ClipboardList, TriangleAlert } from 'lucide-react';

import { OperationsDashboard } from '@/components/operations-dashboard';
import type { PayoutRequestRow } from '@/components/payout-requests-table';
import { Callout, RailCard } from '@/components/ui/kit';
import { istNow } from '@/lib/admin-overview';
import { apiFetch, getSession } from '@/lib/api';
import type { OverviewRow } from '@/lib/calling-shared';

/**
 * F-702 Manager dashboard (REQ-15 §15.2). F-814: greeting + Today rail of what waits on the Manager — pending
 * actions, payout requests awaiting their approval, team callbacks due — from endpoints the Manager already reads.
 */
export default async function ManagerDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const clock = istNow();
  const [session, pending, approvals, team] = await Promise.allSettled([
    getSession(),
    apiFetch<PendingAction[]>('/pending-actions'),
    apiFetch<PayoutRequestRow[]>('/payouts/requests?awaitingMe=true&pageSize=5'),
    apiFetch<{ telecallers: OverviewRow[] }>('/calling/team/overview'),
  ]);
  const name = session.status === 'fulfilled' ? session.value?.user.fullName : null;
  const actions = pending.status === 'fulfilled' ? pending.value.data.filter((a) => !a.doneAt) : null;
  const awaiting = approvals.status === 'fulfilled' ? approvals.value : null;
  const callers = team.status === 'fulfilled' ? team.value.data.telecallers.filter((t) => t.followUpsDue > 0).sort((a, b) => b.followUpsDue - a.followUpsDue) : null;
  const unavailable = (what: string) => (
    <Callout tone="warning" icon={TriangleAlert} title={`${what} could not be loaded.`}>
      Refresh to retry.
    </Callout>
  );

  return (
    <OperationsDashboard
      basePath="/manager/dashboard"
      endpoint="/dashboards/manager"
      sp={await searchParams}
      title="Team dashboard"
      heading={
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-[28px] sm:leading-9">
            {clock.greeting}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{clock.dateLabel} · team dashboard</p>
        </header>
      }
      aside={
        <>
          <h2 className="text-sm font-semibold text-foreground">Today</h2>
          {actions ? (
            <RailCard
              title="Pending actions"
              icon={ClipboardList}
              tone="amber"
              count={actions.length}
              empty="Nothing pending on your team's leads."
              items={actions.slice(0, 5).map((a) => ({ key: a.id, href: `/manager/leads/${a.leadId}`, title: a.whatToDo, meta: `${a.customer} · ${a.issuer}`, aside: a.owner.name ?? undefined }))}
              footer={actions.length ? { href: '/manager/pending-actions', label: 'All pending actions' } : undefined}
            />
          ) : (
            unavailable('Pending actions')
          )}
          {awaiting ? (
            <RailCard
              title="Payouts awaiting you"
              icon={BadgeCheck}
              tone="violet"
              count={Number(awaiting.meta.total ?? awaiting.data.length)}
              empty="No payout request is waiting for your approval."
              items={awaiting.data.map((r) => ({ key: r.id, href: `/manager/payouts/requests/${r.id}`, title: r.advisor.fullName, meta: r.publicRef, aside: formatInr(r.totalAmountInr) }))}
              footer={awaiting.data.length ? { href: '/manager/payouts/requests?awaitingMe=true', label: 'All awaiting my approval' } : undefined}
            />
          ) : (
            unavailable('Payout approvals')
          )}
          {callers ? (
            <RailCard
              title="Callbacks due"
              icon={CalendarClock}
              tone="sky"
              count={callers.reduce((n, t) => n + t.followUpsDue, 0)}
              empty="No callbacks due for your team."
              items={callers.slice(0, 5).map((t) => ({ key: t.id, href: `/manager/calling/telecaller/${t.id}`, title: t.fullName, meta: `${t.queueSize} records held`, aside: `${t.followUpsDue} due` }))}
              footer={callers.length ? { href: '/manager/calling', label: 'Team calling' } : undefined}
            />
          ) : (
            unavailable('Callbacks')
          )}
        </>
      }
    />
  );
}
