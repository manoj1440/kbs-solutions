import { Activity, ShieldAlert } from 'lucide-react';

import {
  AddNetworkForm,
  GrantWfhForm,
} from '@/components/network-policy';
import {
  Callout,
  MiniStat,
  PillNav,
} from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { type WfhRow, wfhOpen } from '@/lib/wfh';

import { type AccessEvent, AccessEventsTable, type Network, NetworksTable, WfhTable } from './network-tables';

export const metadata = { title: 'Network policy · KBS Solutions' };

const OUTCOME_LABEL: Record<string, string> = { DENIED: 'Denied', ALLOWED_OFFICE: 'Office', ALLOWED_WFH: 'WFH' };

/** F-301 → F-811 Admin: office-network allowlist, WFH exceptions and access events (REQ-09 §9.1, REQ-16 §16.2). */
export default async function NetworkPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string }>;
}) {
  const sp = await searchParams;
  const outcome = sp.outcome === 'all' ? '' : (sp.outcome ?? 'DENIED');
  const [networks, wfh, events, telecallers] = await Promise.all([
    apiFetch<Network[]>('/access-policy/networks'),
    apiFetch<WfhRow[]>('/access-policy/wfh'),
    apiFetch<AccessEvent[]>(`/access-policy/events?pageSize=50${outcome ? `&outcome=${outcome}` : ''}`),
    apiFetch<{ id: string; fullName: string; employeeCode: string | null }[]>(
      '/users?role=TELECALLER&status=ACTIVE&pageSize=100',
    ),
  ]);
  const activeNets = networks.data.filter((n) => n.active).length;
  const current = wfh.data.filter((w) => wfhOpen(w));
  const eventsTotal = Number(events.meta.total ?? events.data.length);
  const outcomeLabel = outcome ? OUTCOME_LABEL[outcome]?.toLowerCase() : '';
  const tcTotal = Number(telecallers.meta.total ?? telecallers.data.length);
  const activeFilter = sp.outcome === 'all' ? '/admin/network?outcome=all' : outcome === 'DENIED' ? '/admin/network?outcome=DENIED' : '';
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Office network policy</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Active networks" value={activeNets} hint={activeNets ? `${networks.data.length} on the allowlist` : 'Fail-closed: WFH only'} tone={activeNets ? 'emerald' : 'rose'} />
        <MiniStat label="WFH exceptions" value={current.length} hint="Current or scheduled" tone="violet" />
        <MiniStat label="Access events" value={eventsTotal} hint={outcomeLabel ? `Showing ${outcomeLabel}` : 'All outcomes'} tone={outcome === 'DENIED' && eventsTotal ? 'amber' : 'sky'} />
        <MiniStat label="Active Telecallers" value={tcTotal} hint="Subject to the office check" tone="slate" />
      </div>
      {activeNets ? null : (
        <Callout tone="danger" icon={ShieldAlert} title="Calling is blocked outside WFH exceptions" role="status" className="shrink-0">
          No active network — every Telecaller without a WFH exception is blocked (fails closed).
        </Callout>
      )}
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-visible">
        <section aria-label="Office networks" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 p-3">
            <AddNetworkForm />
          </div>
          <div className="min-h-0 flex-1">
            <NetworksTable rows={networks.data} />
          </div>
        </section>
        <section aria-label="Work-from-home exceptions" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 p-3">
            <GrantWfhForm telecallers={telecallers.data} />
          </div>
          <div className="min-h-0 flex-1">
            <WfhTable rows={wfh.data} />
          </div>
        </section>
        <section aria-label="Access events" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)] lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <PillNav
              label="Show access events"
              active={activeFilter}
              items={[
                { href: '/admin/network?outcome=DENIED', label: 'Denials', icon: ShieldAlert },
                { href: '/admin/network?outcome=all', label: 'All', icon: Activity },
              ]}
            />
            <span className="text-xs text-slate-500 tabular-nums">{eventsTotal} {outcomeLabel} events · allowed checks sampled 1/5min per telecaller</span>
          </div>
          <div className="min-h-0 flex-1">
            <AccessEventsTable rows={events.data} />
          </div>
        </section>
      </div>
    </div>
  );
}
