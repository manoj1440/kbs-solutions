import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface TeamUser {
  id: string;
  fullName: string;
  role: string;
  status: string;
  mobileMasked: string;
  employeeCode: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** F-201/F-105: Manager team list. Training columns arrive with F-205. */
export default async function ManagerTeam() {
  const users = await apiFetch<TeamUser[]>('/users?pageSize=200');
  const telecallers = users.data.filter((u) => u.role === 'TELECALLER');
  const advisors = users.data.filter((u) => u.role === 'ADVISOR');
  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My team</h1>
          <p className="text-muted-foreground text-sm">
            {telecallers.length} Telecallers · {advisors.length} Advisors reporting to you.
          </p>
        </div>
        <Button asChild>
          <Link href="/manager/telecallers/new">Create Telecaller</Link>
        </Button>
      </div>
      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Telecallers</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Employee code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Last login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {telecallers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No Telecallers yet. Create one with just a name and mobile number — training starts at their first login.
                </TableCell>
              </TableRow>
            ) : (
              telecallers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/manager/telecallers/${u.id}`} className="underline-offset-4 hover:underline">
                      {u.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.employeeCode}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === 'ACTIVE' ? 'success' : 'unknown'}>{u.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.mobileMasked}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'never'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Advisors</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mobile</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advisors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Advisors join your team when they apply one of your Agent Codes.
                </TableCell>
              </TableRow>
            ) : (
              advisors.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.fullName || '(onboarding)'}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === 'ACTIVE' ? 'success' : 'warning'}>{u.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.mobileMasked}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
