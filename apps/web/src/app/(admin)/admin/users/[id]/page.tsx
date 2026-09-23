import { type ConfigEntry, formatDateTime } from '@kbs/shared';
import Link from 'next/link';

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

import { LifecycleAction } from '../user-actions';
import { statusVariant } from '../user-status';

interface UserDetail {
  id: string;
  publicRef: string;
  role: string;
  status: string;
  fullName: string;
  mobileMasked: string;
  email: string | null;
  employeeCode: string | null;
  reportingParent: { id: string; fullName: string; role: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
  lifecycle: {
    id: string;
    eventType: string;
    reason: string;
    at: string;
    actor: { fullName: string; role: string } | null;
  }[];
  sessions: { id: string; platform: string; createdAt: string; lastSeenAt: string | null }[];
}

const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Created',
  ACTIVATED: 'Activated',
  DEACTIVATED: 'Deactivated',
  BLOCKED: 'Blocked',
  REACTIVATED: 'Reactivated',
  MOBILE_CHANGED: 'Login mobile changed',
};

/** F-105 Admin user detail: profile, reporting parent, lifecycle timeline, active sessions and reason-gated actions. */
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: u }, { data: cfg }] = await Promise.all([
    apiFetch<UserDetail>(`/users/${id}`),
    apiFetch<ConfigEntry[]>('/config'),
  ]);
  const recoveryEnabled = cfg.find((c) => c.key === 'auth.recoveryEnabled')?.value === true;
  const isAdmin = u.role === 'ADMIN';
  return (
    <div className="grid gap-6">
      <div>
        <Link href="/admin/users" className="text-muted-foreground text-sm hover:underline">
          ← Users & teams
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {u.fullName || '(onboarding)'} <Badge variant="secondary">{u.role}</Badge>{' '}
          <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
        </h1>
        <p className="text-muted-foreground font-mono text-xs">{u.publicRef}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Mobile</dt>
              <dd className="font-mono">{u.mobileMasked}</dd>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd>{u.email ?? '—'}</dd>
              <dt className="text-muted-foreground">Employee code</dt>
              <dd className="font-mono">{u.employeeCode ?? '—'}</dd>
              <dt className="text-muted-foreground">Reports to</dt>
              <dd>
                {u.reportingParent
                  ? `${u.reportingParent.fullName} (${u.reportingParent.role})`
                  : '—'}
              </dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDateTime(u.createdAt)}</dd>
              <dt className="text-muted-foreground">Last login</dt>
              <dd>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Every action needs a reason and is audited.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {isAdmin ? (
              <p className="text-muted-foreground text-sm">
                The Admin account cannot be deactivated.
              </p>
            ) : u.status === 'ACTIVE' ? (
              <LifecycleAction
                userId={u.id}
                action="deactivate"
                label="Deactivate"
                variant="destructive"
              />
            ) : u.status === 'DEACTIVATED' || u.status === 'BLOCKED' ? (
              <LifecycleAction userId={u.id} action="reactivate" label="Reactivate" />
            ) : null}
            <LifecycleAction
              userId={u.id}
              action="sessions/revoke"
              label="Sign out everywhere"
              disabledReason={u.sessions.length ? undefined : 'No active sessions.'}
            />
            <LifecycleAction
              userId={u.id}
              action="change-mobile"
              label="Change login mobile"
              withMobile
              disabledReason={
                recoveryEnabled
                  ? undefined
                  : 'Account recovery is off (auth.recoveryEnabled) — policy not yet approved.'
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>
            Who changed this account, when and why (REQ-04 §4.3). History is never removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {u.lifecycle.length ? (
            <ol className="grid gap-3 border-l pl-4">
              {u.lifecycle.map((e) => (
                <li key={e.id} className="grid gap-0.5">
                  <span className="font-medium">{EVENT_LABEL[e.eventType] ?? e.eventType}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(e.at)} ·{' '}
                    {e.actor ? `${e.actor.fullName} (${e.actor.role})` : 'system'}
                  </span>
                  <span className="text-sm">{e.reason}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">No lifecycle events.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {u.sessions.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Signed in</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {u.sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.platform}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-xs">
                      {s.lastSeenAt ? formatDateTime(s.lastSeenAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No active sessions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
