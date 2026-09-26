import { type ConfigEntry, formatDateTime } from '@kbs/shared';
import {
  ArrowLeft,
  Ban,
  CircleCheck,
  History,
  type LucideIcon,
  Monitor,
  PlusCircle,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  UserMinus,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  EmptyState,
  humanize,
  IconTile,
  KeyValueGrid,
  PageHeader,
  SectionCard,
  StatusDot,
  type Tone,
  TONE,
} from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { LifecycleAction } from '../user-actions';
import { roleChipClass, statusVariant } from '../user-status';

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
const EVENT_LOOK: Record<string, { icon: LucideIcon; tone: Tone }> = {
  CREATED: { icon: PlusCircle, tone: 'sky' },
  ACTIVATED: { icon: CircleCheck, tone: 'emerald' },
  DEACTIVATED: { icon: UserMinus, tone: 'slate' },
  BLOCKED: { icon: Ban, tone: 'rose' },
  REACTIVATED: { icon: RotateCcw, tone: 'emerald' },
  MOBILE_CHANGED: { icon: Smartphone, tone: 'amber' },
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
      <Link
        href="/admin/users"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Users & teams
      </Link>

      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgb(139_92_246/10%),transparent_65%)]"
        />
        <div className="relative grid gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar
              name={u.fullName || u.publicRef}
              size="lg"
              className="ring-4 ring-white shadow-sm"
            />
            <PageHeader
              eyebrow="Workspace · People & teams"
              tone="violet"
              title={u.fullName || '(onboarding)'}
              meta={
                <>
                  <span className={roleChipClass(u.role)}>{humanize(u.role)}</span>
                  <Badge variant={statusVariant(u.status)}>{humanize(u.status)}</Badge>
                  <span className="font-mono text-slate-500">{u.publicRef}</span>
                </>
              }
            />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <KeyValueGrid
              cols={3}
              items={[
                [
                  'Mobile',
                  <span key="m" className="font-mono">
                    {u.mobileMasked}
                  </span>,
                ],
                ['E-mail', u.email ?? '—'],
                [
                  'Employee code',
                  <span key="c" className="font-mono">
                    {u.employeeCode ?? '—'}
                  </span>,
                ],
                [
                  'Reports to',
                  u.reportingParent ? (
                    <span key="r" className="inline-flex items-center gap-2">
                      <Avatar
                        name={u.reportingParent.fullName}
                        size="sm"
                        className="size-6 text-[9px]"
                      />
                      {`${u.reportingParent.fullName} (${humanize(u.reportingParent.role)})`}
                    </span>
                  ) : (
                    '—'
                  ),
                ],
                ['Created', formatDateTime(u.createdAt)],
                ['Last login', u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'],
              ]}
            />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <SectionCard
          icon={History}
          tone="sky"
          title="Lifecycle"
          description="Who changed this account, when and why (REQ-04 §4.3). History is never removed."
        >
          {u.lifecycle.length ? (
            <ol className="grid gap-0">
              {u.lifecycle.map((e, i) => {
                const look = EVENT_LOOK[e.eventType] ?? { icon: History, tone: 'slate' as Tone };
                const last = i === u.lifecycle.length - 1;
                return (
                  <li
                    key={e.id}
                    className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
                  >
                    {last ? null : (
                      <span
                        aria-hidden="true"
                        className="absolute top-9 bottom-1 left-4 w-px -translate-x-1/2 bg-slate-200"
                      />
                    )}
                    <IconTile
                      icon={look.icon}
                      tone={look.tone}
                      size="sm"
                      className="size-8 rounded-full"
                    />
                    <div className="min-w-0 pt-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className={cn('text-sm font-semibold', TONE[look.tone].text)}>
                          {EVENT_LABEL[e.eventType] ?? e.eventType}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {formatDateTime(e.at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm break-words text-slate-800">{e.reason}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {e.actor ? `${e.actor.fullName} (${humanize(e.actor.role)})` : 'system'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState icon={History} title="No lifecycle events." />
          )}
        </SectionCard>

        <div className="grid content-start gap-6">
          <SectionCard
            icon={ShieldAlert}
            tone="amber"
            title="Actions"
            description="Every action needs a reason and is audited."
          >
            <div className="grid gap-3">
              {isAdmin ? (
                <p className="text-sm text-slate-500">The Admin account cannot be deactivated.</p>
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
            </div>
          </SectionCard>

          <SectionCard
            icon={Monitor}
            tone="teal"
            title="Active sessions"
            actions={
              <StatusDot tone={u.sessions.length ? 'emerald' : 'slate'}>
                <span className="tabular-nums">{u.sessions.length}</span>
              </StatusDot>
            }
            flush={u.sessions.length > 0}
          >
            {u.sessions.length ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {u.sessions.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      {/android|ios|mobile/i.test(s.platform) ? (
                        <Smartphone className="size-4" aria-hidden="true" />
                      ) : (
                        <Monitor className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <dl className="grid min-w-0 flex-1 gap-0.5 text-xs">
                      <div>
                        <dt className="sr-only">Platform</dt>
                        <dd className="text-sm font-medium text-slate-800">{s.platform}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-1.5 text-slate-500">
                        <dt>Signed in</dt>
                        <dd className="text-slate-700 tabular-nums">{formatDateTime(s.createdAt)}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-1.5 text-slate-500">
                        <dt>Last seen</dt>
                        <dd className="text-slate-700 tabular-nums">
                          {s.lastSeenAt ? formatDateTime(s.lastSeenAt) : '—'}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={UserRound} title="No active sessions." />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
