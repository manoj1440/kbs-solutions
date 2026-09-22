import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

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

export default async function UsersPage() {
  const users = await apiFetch<UserRow[]>('/users?pageSize=100');
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users & teams</h1>
        <p className="text-muted-foreground text-sm">{String(users.meta.total ?? users.data.length)} users. Create/deactivate dialogs land with F-105 UI.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Reports to</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.data.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.fullName || <span className="text-muted-foreground">(onboarding)</span>}</TableCell>
              <TableCell>
                <Badge variant="secondary">{u.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={u.status === 'ACTIVE' ? 'success' : u.status === 'PENDING_ONBOARDING' ? 'warning' : 'unknown'}>{u.status}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{u.mobileMasked}</TableCell>
              <TableCell className="font-mono text-xs">{u.employeeCode ?? '—'}</TableCell>
              <TableCell>{u.reportingParent?.fullName ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
