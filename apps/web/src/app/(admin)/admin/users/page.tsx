import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { statusVariant } from './user-status';

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
const sel = 'border-input bg-background h-9 rounded-md border px-2 text-sm';

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
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users & teams</h1>
          <p className="text-muted-foreground text-sm">
            Deactivation revokes sessions immediately and keeps every assignment, training record,
            lead and payout (nothing is deleted).
          </p>
        </div>
        <CreateUserDialog />
      </div>
      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/admin/users"
            className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"
          >
            <div className="grid gap-1">
              <Label htmlFor="q">Search</Label>
              <Input
                id="q"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Name, employee code or KBS-U-…"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" defaultValue={sp.role ?? ''} className={sel}>
                <option value="">All roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={sp.status ?? ''} className={sel}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {total} user{total === 1 ? '' : 's'}
          </CardTitle>
          <CardDescription>
            Open a user for the lifecycle timeline, active sessions and actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Table>
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
                  <TableCell>
                    <Link
                      className="font-medium underline-offset-2 hover:underline"
                      href={`/admin/users/${u.id}`}
                    >
                      {u.fullName || '(onboarding)'}
                    </Link>
                    <div className="text-muted-foreground font-mono text-xs">{u.publicRef}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.mobileMasked}</TableCell>
                  <TableCell className="font-mono text-xs">{u.employeeCode ?? '—'}</TableCell>
                  <TableCell>{u.reportingParent?.fullName ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page - 1)}>Previous</Link>
                </Button>
              ) : null}
              <span className="text-muted-foreground">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page + 1)}>Next</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
