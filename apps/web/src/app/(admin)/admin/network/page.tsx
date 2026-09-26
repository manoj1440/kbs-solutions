import { formatDateTime } from '@kbs/shared';
import { Activity, Building2, House, ShieldAlert, Users, Wifi } from 'lucide-react';

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
  PageHeader,
  PillNav,
  SectionCard,
  StatCard,
  StatGrid,
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

/** F-301 Admin: office-network allowlist, WFH exceptions and access events (REQ-09 §9.1, REQ-16 §16.2). */
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
    apiFetch<AccessEvent[]>(
      `/access-policy/events?pageSize=50${outcome ? `&outcome=${outcome}` : ''}`,
    ),
    apiFetch<{ id: string; fullName: string; employeeCode: string | null }[]>(
      '/users?role=TELECALLER&status=ACTIVE&pageSize=100',
    ),
  ]);
  const activeNets = networks.data.filter((n) => n.active).length;
  const current = wfh.data.filter((w) => wfhOpen(w));
  const eventsTotal = Number(events.meta.total ?? events.data.length);
  const outcomeLabel = outcome
    ? OUTCOME[outcome as AccessEvent['outcome']]?.label.toLowerCase()
    : '';
  const tcTotal = Number(telecallers.meta.total ?? telecallers.data.length);
  const activeFilter =
    sp.outcome === 'all'
      ? '/admin/network?outcome=all'
      : outcome === 'DENIED'
        ? '/admin/network?outcome=DENIED'
        : '';
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Wifi}
        eyebrow="Administration"
        title="Office network policy"
        tone="sky"
        description="Telecallers can use calling screens only from an office egress IP or with an active work-from-home exception. The check runs on the server from the request IP; the Wi-Fi name the app reports is stored as a hint and never trusted. Advisors are never checked."
      >
        <StatGrid>
          <StatCard
            label="Active networks"
            value={activeNets}
            hint={
              activeNets
                ? `${networks.data.length} on the allowlist in total`
                : 'Fails closed — only WFH exceptions can call'
            }
            icon={Building2}
            tone={activeNets ? 'emerald' : 'rose'}
          />
          <StatCard
            label="WFH exceptions"
            value={current.length}
            hint="Current or scheduled"
            icon={House}
            tone="violet"
          />
          <StatCard
            label="Access events"
            value={eventsTotal}
            hint={outcomeLabel ? `Showing ${outcomeLabel} events` : 'All outcomes'}
            icon={Activity}
            tone={outcome === 'DENIED' && eventsTotal ? 'amber' : 'sky'}
          />
          <StatCard
            label="Active Telecallers"
            value={tcTotal}
            hint={
              tcTotal > telecallers.data.length
                ? `First ${telecallers.data.length} listed in the WFH picker`
                : 'Subject to the office-network check'
            }
            icon={Users}
            tone="slate"
          />
        </StatGrid>
      </PageHeader>

      {activeNets ? null : (
        <Callout
          tone="danger"
          icon={ShieldAlert}
          title="Calling is blocked outside WFH exceptions"
          role="status"
        >
          No active network — every Telecaller without a WFH exception is blocked (fails closed).
        </Callout>
      )}

      <SectionCard
        icon={Building2}
        tone={activeNets ? 'emerald' : 'rose'}
        title="Office networks"
        description={
          activeNets
            ? `${activeNets} active`
            : 'No active network — every Telecaller without a WFH exception is blocked (fails closed).'
        }
        className={activeNets ? undefined : 'border-rose-200'}
        flush
      >
        <div className="px-5 pb-5 sm:px-6">
          <AddNetworkForm />
        </div>
        {networks.data.length ? (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>CIDR</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {networks.data.map((n) => (
                <TableRow key={n.id}>
                  <TableCell data-label="Label" className="font-medium text-slate-800">
                    {n.label}
                  </TableCell>
                  <TableCell data-label="CIDR">
                    <code className="rounded-md bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-800 ring-1 ring-slate-200 ring-inset">
                      {n.cidr}
                    </code>
                  </TableCell>
                  <TableCell data-label="Status">
                    {n.active ? (
                      <Badge variant="success">active</Badge>
                    ) : (
                      <Badge variant="unknown">inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell data-label="Added" className="text-xs text-slate-600">
                    {formatDateTime(n.createdAt)}
                  </TableCell>
                  <TableCell className="sm:text-right">
                    <NetworkActiveToggle id={n.id} active={n.active} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-5 pb-5 sm:px-6">
            <EmptyState
              className="py-7"
              icon={Building2}
              title="No office networks yet"
              description="Add the office egress CIDR above. Until one is active, only Telecallers with a WFH exception can call."
            />
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={House}
        tone="violet"
        title="Work-from-home exceptions"
        description={`${current.length} current or scheduled. Managers grant for their own Telecallers; the Admin can grant for anyone. Revocation applies to the next request.`}
        flush
      >
        <div className="px-5 pb-5 sm:px-6">
          <GrantWfhForm telecallers={telecallers.data} />
        </div>
        {wfh.data.length ? (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Telecaller</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Granted by</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {wfh.data.map((w) => (
                <TableRow key={w.id}>
                  <TableCell data-label="Telecaller">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={w.telecaller?.fullName ?? w.telecallerUserId} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">
                          {w.telecaller?.fullName ?? w.telecallerUserId}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {w.telecaller?.employeeCode}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="Window" className="text-xs text-slate-600">
                    {formatDateTime(w.startsAt)} →{' '}
                    {w.endsAt ? formatDateTime(w.endsAt) : 'until revoked'}
                    {w.revokedAt ? (
                      <div className="mt-0.5 text-rose-600">
                        revoked {formatDateTime(w.revokedAt)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell data-label="Granted by" className="text-xs text-slate-600">
                    {w.grantedBy ? `${w.grantedBy.fullName} (${humanize(w.grantedBy.role)})` : '—'}
                  </TableCell>
                  <TableCell data-label="Reason" className="text-xs text-slate-600">
                    {w.reason}
                  </TableCell>
                  <TableCell className="sm:text-right">
                    {!wfhOpen(w) ? null : <RevokeWfhButton id={w.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-5 pb-5 sm:px-6">
            <EmptyState
              className="py-7"
              icon={House}
              title="No WFH exceptions"
              description="Telecallers can call only from an office network until an exception is granted."
            />
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={Activity}
        tone="amber"
        title="Access events"
        description={`${String(events.meta.total ?? events.data.length)} ${outcomeLabel} events. Every denial is recorded; allowed checks are sampled to one per Telecaller per 5 minutes.`}
        actions={
          <PillNav
            label="Show access events"
            active={activeFilter}
            items={[
              { href: '/admin/network?outcome=DENIED', label: 'Denials', icon: ShieldAlert },
              { href: '/admin/network?outcome=all', label: 'All', icon: Activity },
            ]}
          />
        }
        flush={events.data.length > 0}
      >
        {events.data.length ? (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Telecaller</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Wi-Fi hint</TableHead>
                <TableHead>Route</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600">
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
                    {e.matchedNetwork ? (
                      <span className="ml-1 text-xs text-slate-500">{e.matchedNetwork.label}</span>
                    ) : null}
                  </TableCell>
                  <TableCell data-label="IP" className="font-mono text-xs text-slate-700">
                    {e.ip}
                  </TableCell>
                  <TableCell data-label="Wi-Fi hint" className="text-xs text-slate-600">
                    {e.ssidHint ?? '—'}
                  </TableCell>
                  <TableCell
                    data-label="Route"
                    className="font-mono text-xs break-all text-slate-600"
                  >
                    {e.route ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Activity}
            title="No events"
            description="Denied and sampled allowed checks appear here."
          />
        )}
      </SectionCard>
    </div>
  );
}
