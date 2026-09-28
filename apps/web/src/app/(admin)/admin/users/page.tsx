import { formatDateTime } from '@kbs/shared';
import { ChevronLeft, ChevronRight, Filter, Users } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Avatar,
  EmptyState,
  humanize,
  MiniStat,
  selectClass,
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
import { cn } from '@/lib/utils';

import { CreateUserDialog } from './user-actions';
import { roleChipClass, statusTone } from './user-status';

export const metadata = { title: 'Users & teams · KBS Solutions' };

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

/** F-105 → F-811 Admin: compact users table — tiles, one filter row, internal scroll, footer pagination. */
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
  const count = (s: string) => users.data.filter((u) => u.status === s).length;
  const filtered = Boolean(sp.role || sp.status || sp.q);
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Users &amp; teams</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Users" value={total.toLocaleString('en-IN')} hint={filtered ? 'Matching the filters' : 'Every role, every status'} tone="sky" />
        <MiniStat label="Active" value={count('ACTIVE')} hint={total > users.data.length ? 'On this page' : 'All users'} tone="emerald" />
        <MiniStat label="Pending onboarding" value={count('PENDING_ONBOARDING')} hint={total > users.data.length ? 'On this page' : 'All users'} tone={count('PENDING_ONBOARDING') ? 'amber' : 'slate'} />
        <MiniStat label="Deactivated / blocked" value={count('DEACTIVATED') + count('BLOCKED')} hint={total > users.data.length ? 'On this page' : 'All users'} tone={count('BLOCKED') ? 'rose' : 'slate'} />
      </div>

      <section aria-label="Users" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Form action="/admin/users" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input aria-label="Search" name="q" defaultValue={sp.q ?? ''} placeholder="Name, employee code or KBS-U-…" className={cn(selectClass, 'h-9 min-w-44 flex-[2_1_12rem]')} />
            <select aria-label="Role" name="role" defaultValue={sp.role ?? ''} className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')}>
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
            <select aria-label="Status" name="status" defaultValue={sp.status ?? ''} className={cn(selectClass, 'h-9 min-w-40 flex-[1_1_9rem]')}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" className="h-9">
              <Filter />
              Apply
            </Button>
            {filtered ? (
              <Button asChild size="sm" variant="ghost" className="h-9">
                <Link href="/admin/users">Reset</Link>
              </Button>
            ) : null}
          </Form>
          <CreateUserDialog />
        </div>
        <div className="min-h-0 flex-1">
          {users.data.length === 0 ? (
            <EmptyState
              icon={Users}
              className="m-3"
              title={filtered ? 'No users match these filters' : 'No users yet'}
              description={filtered ? 'Clear the search or pick another role or status.' : 'Create a Manager or Accounts user; Advisors register themselves.'}
            />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Reports to</TableHead>
                  <TableHead className="pr-4">Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="pl-4" data-label="Name">
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
                    <TableCell className="pr-4 text-xs text-slate-600 tabular-nums" data-label="Last login">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-slate-400">never</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-500 tabular-nums">
            {total ? `${((page - 1) * 50 + 1).toLocaleString('en-IN')}–${Math.min(page * 50, total).toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}` : '0 users'} · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={pageHref(page - 1)}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={pageHref(page + 1)}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
