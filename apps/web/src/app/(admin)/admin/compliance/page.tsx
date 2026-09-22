import { formatDateTime } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { ComplianceActions, LiftButton } from './actions';

interface Suppression {
  id: string;
  mobile: string;
  reason: string;
  at: string;
  liftedAt: string | null;
  createdByUserId: string | null;
}

/** F-306 / F-304 Admin: suppression list, DND import, pincode master import. */
export default async function CompliancePage() {
  const s = await apiFetch<Suppression[]>('/suppressions?pageSize=100&includeLifted=true');
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Compliance & reference data</h1>
        <p className="text-muted-foreground text-sm">Do-not-contact suppression applies to every import and blocks call initiation server-side. Records are hidden, never deleted (INV-07).</p>
      </div>
      <ComplianceActions />
      <Card>
        <CardHeader>
          <CardTitle>Suppressed mobiles</CardTitle>
          <CardDescription>{String(s.meta.total ?? s.data.length)} entries (including lifted).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mobile</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.mobile}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.reason}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(r.at)}</TableCell>
                  <TableCell>{r.liftedAt ? <Badge variant="unknown">lifted {formatDateTime(r.liftedAt)}</Badge> : <Badge variant="destructive">active</Badge>}</TableCell>
                  <TableCell>{r.liftedAt ? null : <LiftButton id={r.id} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
