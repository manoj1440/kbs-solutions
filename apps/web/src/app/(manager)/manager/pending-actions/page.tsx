import { formatDateTime, type PendingAction } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

/** F-409 (Manager): concrete pending actions across the team — owner / what / source / date. Nothing is invented from blank MIS cells. */
export default async function ManagerPendingActionsPage() {
  const r = await apiFetch<PendingAction[]>('/pending-actions');
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Pending actions</h1>
        <p className="text-muted-foreground text-sm">Explicit follow-up tasks and Admin-configured MIS rules only. A blank or generic bank value never creates a task.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{r.data.length} item(s)</CardTitle>
          <CardDescription>Ordered by date. Bank-sourced items show the exact bank text and the batch it came from.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issuer / card</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>What to do</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-center">
                    No pending actions.
                  </TableCell>
                </TableRow>
              ) : null}
              {r.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link className="underline" href={`/manager/leads/${a.leadId}`}>
                      {a.leadRef}
                    </Link>
                  </TableCell>
                  <TableCell>{a.customer}</TableCell>
                  <TableCell>
                    {a.issuer} · {a.card}
                  </TableCell>
                  <TableCell>{a.owner.name ?? <span className="text-muted-foreground">{a.owner.role === 'BANK' ? 'Bank (informational)' : '—'}</span>}</TableCell>
                  <TableCell>{a.whatToDo}</TableCell>
                  <TableCell>{a.source.type === 'KBS_TASK' ? <Badge variant="info">Follow-up task</Badge> : <Badge variant="secondary">Bank MIS · {a.source.field}{a.source.batchRef ? ` · ${a.source.batchRef}` : ''}</Badge>}</TableCell>
                  <TableCell>{formatDateTime(a.date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
