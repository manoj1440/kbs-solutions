import { formatDateTime } from '@kbs/shared';
import { Clock, Filter, Search, UserCheck, UserX, Users } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Avatar,
  EmptyState,
  Field,
  humanize,
  PageHeader,
  SectionCard,
  selectClass,
  StatCard,
  StatGrid,
  StatusDot,
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

import { CreateUserDialog } from './user-actions';
import { roleChipClass, statusTone } from './user-status';

interface UserRow {
  id: string;
  publicRef: string;
  role: string;
  status: string;
  fullName: string;
  mobileMasked: string;
  employeeCode: string | null;
  reportingParent: { fullName: string } | null;
  lastLoginAt: string | null;
}
type Search = { role?: string; status?: string; q?: string; page?: string };

const ROLES = ['MANAGER', 'TELECALLER', 'ADVISOR', 'ACCOUNTS', 'ADMIN'];
const STATUSES = ['ACTIVE', 'PENDING_ONBOARDING', 'DEACTIVATED', 'BLOCKED'];

/** F-105 Admin: users table with role / status / search filters and the create dialog. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const qs = new URLSearchParams({ pageSize: '50', page: String(page) });
  for (const k of ['role', 'status', 'q'] as const) if (sp[k]) qs.set(k, sp[k] as string);
  const users = await apiFetch<UserRow[]>(`/users?${qs}`);
  const total = Number(users.meta.total ?? users.data.length);
  const pages = Math.max(1, Math.ceil(total / 50));
  const pageHref = (p: number) => {
    const n = new URLSearchParams(qs);
    n.delete('pageSize');
    n.set('page', String(p));
    return `/admin/users?${n}`;
  };
  // KPI counts come from the rows already fetched; say so when that is not everyone.
  const count = (s: string) => users.data.filter((u) => u.status === s).length;
  const scope =
    total > users.data.length
      ? `Of the ${users.data.length} shown on this page`
      : 'Across the list below';
  const filtered = Boolean(sp.role || sp.status || sp.q);
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Users}
        tone="violet"
        eyebrow="Workspace"
        title="Users & teams"
        description="Deactivation revokes sessions immediately and keeps every assignment, training record, lead and payout (nothing is deleted)."
        actions={<CreateUserDialog />}
      >
        <StatGrid>
          <StatCard
            label={filtered ? 'Matching users' : 'Users'}
            value={total}
            hint={filtered ? 'With the filters below' : 'Every role, every status'}
            icon={Users}
            emphasis
          />
          <StatCard
            label="Active"
            value={count('ACTIVE')}
            hint={scope}
            icon={UserCheck}
            tone="emerald"
          />
          <StatCard
            label="Pending onboarding"
            value={count('PENDING_ONBOARDING')}
            hint={scope}
            icon={Clock}
            tone={count('PENDING_ONBOARDING') ? 'amber' : 'slate'}
          />
          <StatCard
            label="Deactivated or blocked"
            value={count('DEACTIVATED') + count('BLOCKED')}
            hint={scope}
            icon={UserX}
            tone={count('BLOCKED') ? 'rose' : 'slate'}
          />
        </StatGrid>
      </PageHeader>

      <SectionCard
        icon={Users}
        tone="violet"
        title={`${total} user${total === 1 ? '' : 's'}`}
        description="Open a user for the lifecycle timeline, active sessions and actions."
        flush
      >
        <form
          method="get"
          action="/admin/users"
          className="grid gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"
        >
          <Field label="Search" htmlFor="q">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="q"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Name, employee code or KBS-U-…"
                className="pl-9"
              />
            </div>
          </Field>
          <Field label="Role" htmlFor="role">
            <select id="role" name="role" defaultValue={sp.role ?? ''} className={selectClass}>
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="status">
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? ''}
              className={selectClass}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" className="h-10">
            <Filter />
            Filter
          </Button>
        </form>
        {users.data.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              icon={Users}
              title={filtered ? 'No users match these filters' : 'No users yet'}
              description={
                filtered
                  ? 'Clear the search or pick another role or status.'
                  : 'Create a Manager or Accounts user; Telecallers are added by Managers and Advisors register themselves.'
              }
            />
          </div>
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Reports to</TableHead>
                <TableHead>Last login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell data-label="Name">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.fullName || u.publicRef} size="sm" />
                      <div className="min-w-0">
                        <Link className="font-medium" href={`/admin/users/${u.id}`}>
                          {u.fullName || '(onboarding)'}
                        </Link>
                        <div className="font-mono text-[11px] text-slate-500">{u.publicRef}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="Role">
                    <span className={roleChipClass(u.role)}>{humanize(u.role)}</span>
                  </TableCell>
                  <TableCell data-label="Status">
                    <StatusDot tone={statusTone(u.status)}>{humanize(u.status)}</StatusDot>
                  </TableCell>
                  <TableCell data-label="Mobile" className="font-mono text-xs text-slate-600">
                    {u.mobileMasked}
                  </TableCell>
                  <TableCell data-label="Code" className="font-mono text-xs text-slate-600">
                    {u.employeeCode ?? '—'}
                  </TableCell>
                  <TableCell data-label="Reports to">
                    {u.reportingParent ? (
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        <Avatar
                          name={u.reportingParent.fullName}
                          size="sm"
                          className="size-6 text-[9px]"
                        />
                        {u.reportingParent.fullName}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    data-label="Last login"
                    className="text-xs text-slate-600 tabular-nums"
                  >
                    {u.lastLoginAt ? (
                      formatDateTime(u.lastLoginAt)
                    ) : (
                      <span className="text-slate-400">never</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {pages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-sm sm:px-6">
            <span className="text-slate-500 tabular-nums">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page - 1)}>Previous</Link>
                </Button>
              ) : null}
              {page < pages ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page + 1)}>Next</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
