import { formatDateTime } from '@kbs/shared';

import {
  AddNetworkForm,
  GrantWfhForm,
  NetworkActiveToggle,
  RevokeWfhButton,
} from '@/components/network-policy';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Office network policy</h1>
        <p className="text-muted-foreground text-sm">
          Telecallers can use calling screens only from an office egress IP or with an active
          work-from-home exception. The check runs on the server from the request IP; the Wi-Fi name
          the app reports is stored as a hint and never trusted. Advisors are never checked.
        </p>
      </div>

      <Card className={activeNets ? '' : 'border-warning'}>
        <CardHeader>
          <CardTitle>Office networks</CardTitle>
          <CardDescription>
            {activeNets
              ? `${activeNets} active`
              : 'No active network — every Telecaller without a WFH exception is blocked (fails closed).'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <AddNetworkForm />
          {networks.data.length ? (
            <Table>
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
                    <TableCell>{n.label}</TableCell>
                    <TableCell className="font-mono text-xs">{n.cidr}</TableCell>
                    <TableCell>
                      {n.active ? (
                        <Badge variant="success">active</Badge>
                      ) : (
                        <Badge variant="unknown">inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(n.createdAt)}</TableCell>
                    <TableCell>
                      <NetworkActiveToggle id={n.id} active={n.active} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work-from-home exceptions</CardTitle>
          <CardDescription>
            {current.length} current or scheduled. Managers grant for their own Telecallers; the
            Admin can grant for anyone. Revocation applies to the next request.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <GrantWfhForm telecallers={telecallers.data} />
          {wfh.data.length ? (
            <Table>
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
                    <TableCell>
                      {w.telecaller?.fullName ?? w.telecallerUserId}
                      <div className="text-muted-foreground font-mono text-xs">
                        {w.telecaller?.employeeCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(w.startsAt)} →{' '}
                      {w.endsAt ? formatDateTime(w.endsAt) : 'until revoked'}
                      {w.revokedAt ? (
                        <div className="text-muted-foreground">
                          revoked {formatDateTime(w.revokedAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {w.grantedBy ? `${w.grantedBy.fullName} (${w.grantedBy.role})` : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{w.reason}</TableCell>
                    <TableCell>{!wfhOpen(w) ? null : <RevokeWfhButton id={w.id} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access events</CardTitle>
          <CardDescription>
            {String(events.meta.total ?? events.data.length)}{' '}
            {outcome ? OUTCOME[outcome as AccessEvent['outcome']]?.label.toLowerCase() : ''} events.
            Every denial is recorded; allowed checks are sampled to one per Telecaller per 5
            minutes. Show:{' '}
            <a className="underline" href="/admin/network?outcome=DENIED">
              denials
            </a>{' '}
            ·{' '}
            <a className="underline" href="/admin/network?outcome=all">
              all
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.data.length ? (
            <Table>
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
                    <TableCell className="text-xs">{formatDateTime(e.at)}</TableCell>
                    <TableCell>{e.user.fullName}</TableCell>
                    <TableCell>
                      <Badge variant={OUTCOME[e.outcome].variant}>{OUTCOME[e.outcome].label}</Badge>
                      {e.matchedNetwork ? (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {e.matchedNetwork.label}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.ip}</TableCell>
                    <TableCell className="text-xs">{e.ssidHint ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{e.route ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No events.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
