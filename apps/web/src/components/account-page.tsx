import { formatDateTime } from '@kbs/shared';

import { AccountActions } from '@/components/account-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import type { MeResponse } from '@kbs/shared';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin (owner)', MANAGER: 'Manager', ACCOUNTS: 'Accounts' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

/** F-804: profile, support and sign-out for the web roles (REQ-25 §25.1, §25.5). Read-only profile; no self-edit. */
export async function AccountPage() {
  const me = (await apiFetch<MeResponse>('/auth/me')).data;
  const u = me.user;
  const support = me.account?.supportContact ?? null;
  const supportHref = support ? (support.includes('@') ? `mailto:${support}` : `tel:${support.replace(/\s+/g, '')}`) : null;
  return (
    <div className="grid max-w-3xl min-w-0 gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Account & support</h1>
        <p className="text-muted-foreground text-sm">Your KBS profile. Sign-in is by OTP to your registered mobile; there is no password.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Changes to name or mobile go through the Admin (mobile changes are audited).</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3">
            <Row label="Name">{u.fullName || '—'}</Row>
            <Row label="Role">
              <Badge variant="secondary">{ROLE_LABEL[u.role] ?? u.role}</Badge>
            </Row>
            <Row label="Mobile">
              <span className="font-mono">{u.mobileMasked}</span>
            </Row>
            <Row label="KBS reference">
              <span className="font-mono">{u.publicRef}</span>
            </Row>
            {u.employeeCode ? <Row label="Employee code">{u.employeeCode}</Row> : null}
            {u.reportingParent ? (
              <Row label="Reports to">
                {u.reportingParent.fullName} ({u.reportingParent.role.toLowerCase()})
              </Row>
            ) : null}
            <Row label="Status">{u.status}</Row>
            <Row label="Last sign-in">{formatDateTime(me.account?.lastLoginAt ?? null)}</Row>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support</CardTitle>
          <CardDescription>For access problems, a lost phone or a changed number.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {support && supportHref ? (
            <a href={supportHref} className="font-medium text-teal-800 underline-offset-2 hover:underline">
              {support}
            </a>
          ) : (
            <p className="text-muted-foreground">
              Not configured yet. {u.role === 'ADMIN' ? 'Set support.contact on the Configuration page.' : 'Contact the KBS Admin directly.'}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
          <CardDescription>&ldquo;Sign out of all devices&rdquo; ends every session of this account, including the Android app, and cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountActions />
        </CardContent>
      </Card>
    </div>
  );
}
