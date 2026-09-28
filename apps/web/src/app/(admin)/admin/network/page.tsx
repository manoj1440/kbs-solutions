import { formatDateTime } from '@kbs/shared';
import { Activity, Building2, House, ShieldAlert } from 'lucide-react';

import {
  AddNetworkForm,
  GrantWfhForm,
  NetworkActiveToggle,
  RevokeWfhButton,
} from '@/components/network-policy';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  Callout,
  EmptyState,
  humanize,
  MiniStat,
  PillNav,
} from '@/components/ui/kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { type WfhRow, wfhOpen } from '@/lib/wfh';

export const metadata = { title: 'Network policy · KBS Solutions' };

interface Network {
  id: string;
  label: string;
  cidr: string;
  active: boolean;
  createdAt: string;
}
interface AccessEvent {
  id: string;
  at: string;
  ip: string;
  ssidHint: string | null;
  outcome: 'DENIED' | 'ALLOWED_OFFICE' | 'ALLOWED_WFH';
  route: string | null;
  user: { id: string; fullName: string; employeeCode: string | null };
  matchedNetwork: { label: string } | null;
}

const OUTCOME: Record<
  AccessEvent['outcome'],
  { label: string; variant: 'destructive' | 'success' | 'info' }
> = {
  DENIED: { label: 'Denied', variant: 'destructive' },
  ALLOWED_OFFICE: { label: 'Office', variant: 'success' },
  ALLOWED_WFH: { label: 'WFH', variant: 'info' },
};

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
  const outcomeLabel = outcome ? OUTCOME[outcome as AccessEvent['outcome']]?.label.toLowerCase() : '';
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
            {networks.data.length ? (
              <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="pl-4">Label</TableHead>
                    <TableHead>CIDR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {networks.data.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="pl-4" data-label="Label">
                        <div className="font-medium text-slate-800">{n.label}</div>
                        <div className="text-[11px] text-slate-500">{formatDateTime(n.createdAt)}</div>
                      </TableCell>
                      <TableCell data-label="CIDR">
                        <code className="rounded-md bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-800 ring-1 ring-slate-200 ring-inset">{n.cidr}</code>
                      </TableCell>
                      <TableCell data-label="Status">
                        {n.active ? <Badge variant="success">active</Badge> : <Badge variant="unknown">inactive</Badge>}
                      </TableCell>
                      <TableCell className="pr-4 sm:text-right">
                        <NetworkActiveToggle id={n.id} active={n.active} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState className="m-3 py-7" icon={Building2} title="No office networks yet" description="Add the office egress CIDR above. Until one is active, only Telecallers with a WFH exception can call." />
            )}
          </div>
        </section>
        <section aria-label="Work-from-home exceptions" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 p-3">
            <GrantWfhForm telecallers={telecallers.data} />
          </div>
          <div className="min-h-0 flex-1">
            {wfh.data.length ? (
              <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="pl-4">Telecaller</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wfh.data.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="pl-4" data-label="Telecaller">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={w.telecaller?.fullName ?? w.telecallerUserId} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800">{w.telecaller?.fullName ?? w.telecallerUserId}</div>
                            <div className="font-mono text-[11px] text-slate-500">{w.telecaller?.employeeCode}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-label="Window" className="text-xs text-slate-600">
                        {formatDateTime(w.startsAt)} → {w.endsAt ? formatDateTime(w.endsAt) : 'until revoked'}
                        {w.revokedAt ? <div className="mt-0.5 text-rose-600">revoked {formatDateTime(w.revokedAt)}</div> : null}
                        <div className="text-slate-500">by {w.grantedBy ? `${w.grantedBy.fullName} (${humanize(w.grantedBy.role)})` : '—'}</div>
                      </TableCell>
                      <TableCell data-label="Reason" className="text-xs text-slate-600">{w.reason}</TableCell>
                      <TableCell className="pr-4 sm:text-right">{!wfhOpen(w) ? null : <RevokeWfhButton id={w.id} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState className="m-3 py-7" icon={House} title="No WFH exceptions" description="Telecallers can call only from an office network until an exception is granted." />
            )}
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
            {events.data.length ? (
              <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="pl-4">When</TableHead>
                    <TableHead>Telecaller</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Wi-Fi hint</TableHead>
                    <TableHead className="pr-4">Route</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-4 text-xs whitespace-nowrap text-slate-600" data-label="When">
                        {formatDateTime(e.at)}
                      </TableCell>
                      <TableCell data-label="Telecaller">
                        <div className="flex items-center gap-2">
                          <Avatar name={e.user.fullName} size="sm" />
                          <span className="font-medium text-slate-800">{e.user.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell data-label="Outcome">
                        <Badge variant={OUTCOME[e.outcome].variant}>{OUTCOME[e.outcome].label}</Badge>
                        {e.matchedNetwork ? <span className="ml-1 text-xs text-slate-500">{e.matchedNetwork.label}</span> : null}
                      </TableCell>
                      <TableCell data-label="IP" className="font-mono text-xs text-slate-700">{e.ip}</TableCell>
                      <TableCell data-label="Wi-Fi hint" className="text-xs text-slate-600">{e.ssidHint ?? '—'}</TableCell>
                      <TableCell className="pr-4 font-mono text-xs break-all text-slate-600" data-label="Route">{e.route ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState className="m-3" icon={Activity} title="No events" description="Denied and sampled allowed checks appear here." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
