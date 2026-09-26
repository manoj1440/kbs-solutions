import { formatDateTime } from '@kbs/shared';
import { Headphones, LifeBuoy, Mail, MonitorSmartphone, Phone, UserRound } from 'lucide-react';

import { AccountActions } from '@/components/account-actions';
import { Badge } from '@/components/ui/badge';
import { Avatar, Callout, humanize, KeyValueGrid, PageHeader, SectionCard, StatusDot } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import type { MeResponse } from '@kbs/shared';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin (owner)', MANAGER: 'Manager', ACCOUNTS: 'Accounts' };

/** F-804: profile, support and sign-out for the web roles (REQ-25 §25.1, §25.5). Read-only profile; no self-edit. */
export async function AccountPage() {
  const me = (await apiFetch<MeResponse>('/auth/me')).data;
  const u = me.user;
  const support = me.account?.supportContact ?? null;
  const supportHref = support ? (support.includes('@') ? `mailto:${support}` : `tel:${support.replace(/\s+/g, '')}`) : null;
  const rows: [React.ReactNode, React.ReactNode][] = [
    ['Name', u.fullName || '—'],
    ['Role', <Badge key="role" variant="secondary">{ROLE_LABEL[u.role] ?? u.role}</Badge>],
    ['Mobile', <span key="m" className="font-mono">{u.mobileMasked}</span>],
    ['KBS reference', <span key="ref" className="font-mono">{u.publicRef}</span>],
  ];
  if (u.employeeCode) rows.push(['Employee code', u.employeeCode]);
  if (u.reportingParent) rows.push(['Reports to', `${u.reportingParent.fullName} (${u.reportingParent.role.toLowerCase()})`]);
  rows.push(
    ['Status', <StatusDot key="st" tone={u.status === 'ACTIVE' ? 'emerald' : u.status === 'BLOCKED' ? 'rose' : 'amber'}>{humanize(u.status)}</StatusDot>],
    ['Last sign-in', formatDateTime(me.account?.lastLoginAt ?? null)],
  );
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        icon={UserRound}
        tone="violet"
        eyebrow={u.role === 'ADMIN' ? 'Administration' : undefined}
        title="Account & support"
        description="Your KBS profile. Sign-in is by OTP to your registered mobile; there is no password."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard icon={UserRound} tone="violet" title="Profile" description="Changes to name or mobile go through the Admin (mobile changes are audited).">
          <div className="grid gap-5">
            <div className="flex min-w-0 items-center gap-4 rounded-xl bg-[linear-gradient(135deg,rgb(245_243_255)_0%,rgb(240_253_250)_100%)] p-4 ring-1 ring-slate-100 ring-inset">
              <Avatar name={u.fullName || u.publicRef} size="lg" className="shadow-sm ring-4 ring-white" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{u.fullName || '—'}</p>
                <p className="font-mono text-xs text-slate-500">{u.publicRef}</p>
              </div>
            </div>
            <KeyValueGrid items={rows} />
          </div>
        </SectionCard>
        <div className="grid min-w-0 gap-6">
          <SectionCard icon={LifeBuoy} tone="teal" title="Support" description="For access problems, a lost phone or a changed number.">
            {support && supportHref ? (
              <a
                href={supportHref}
                className="lift flex min-w-0 items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-teal-900 hover:border-teal-200"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm ring-1 ring-teal-100">
                  {support.includes('@') ? <Mail className="size-5" aria-hidden="true" /> : <Phone className="size-5" aria-hidden="true" />}
                </span>
                <span className="min-w-0 font-semibold break-words">{support}</span>
              </a>
            ) : (
              <Callout tone="neutral" icon={Headphones}>
                Not configured yet. {u.role === 'ADMIN' ? 'Set support.contact on the Configuration page.' : 'Contact the KBS Admin directly.'}
              </Callout>
            )}
          </SectionCard>
          <SectionCard
            icon={MonitorSmartphone}
            tone="rose"
            title="Sessions"
            description={<>&ldquo;Sign out of all devices&rdquo; ends every session of this account, including the Android app, and cannot be undone.</>}
          >
            <AccountActions />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
