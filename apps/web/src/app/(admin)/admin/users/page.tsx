import { Filter } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { DataTablePagination, DataTablePanel } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { humanize, MiniStat, selectClass } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { CreateUserDialog } from './user-actions';
import { UsersTable, type UserRow } from './users-table';

export const metadata = { title: 'Users & teams · KBS Solutions' };

type Search = { role?: string; status?: string; q?: string; page?: string };

const ROLES = ['MANAGER', 'TELECALLER', 'ADVISOR', 'ACCOUNTS', 'ADMIN'];
const STATUSES = ['ACTIVE', 'PENDING_ONBOARDING', 'DEACTIVATED', 'BLOCKED'];
const PAGE_SIZE = 50;

/** F-105 → F-811 → F-813 Admin: compact users table — tiles, one filter row, internal scroll, footer pagination. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const qs = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
  for (const k of ['role', 'status', 'q'] as const) if (sp[k]) qs.set(k, sp[k] as string);
  const users = await apiFetch<UserRow[]>(`/users?${qs}`);
  const total = Number(users.meta.total ?? users.data.length);
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

      <DataTablePanel
        label="Users"
        toolbar={
          <>
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
          </>
        }
        footer={<DataTablePagination page={page} pageSize={PAGE_SIZE} total={total} href={pageHref} noun="users" />}
      >
        <UsersTable rows={users.data} filtered={filtered} />
      </DataTablePanel>
    </div>
  );
}
