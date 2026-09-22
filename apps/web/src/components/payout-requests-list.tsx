import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

import { PayoutStateBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface Row {
  id: string;
  publicRef: string;
  state: string;
  advisor: { id: string; fullName: string };
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  approvals: { role: string; decision: string; at: string }[];
  outstanding: string[];
  payment: { state: string; paidAt: string } | null;
}
const STATES = ['', 'PENDING_APPROVALS', 'APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'REJECTED', 'CANCELLED', 'ON_HOLD'];

/** F-603/F-604 — payout requests with outstanding approvals; "awaiting me" shows the viewer's own queue. */
export async function PayoutRequestsList({ basePath, sp, title, description }: { basePath: string; sp: { state?: string; awaitingMe?: string; page?: string }; title: string; description: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const r = await apiFetch<Row[]>(`/payouts/requests?${qs.toString()}`);
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button asChild size="sm" variant={sp.awaitingMe === 'true' ? 'default' : 'outline'}>
          <Link href={`${basePath}?awaitingMe=true`}>Awaiting my approval</Link>
        </Button>
        {STATES.map((s) => (
          <Button key={s || 'all'} asChild size="sm" variant={!sp.awaitingMe && (sp.state ?? '') === s ? 'default' : 'outline'}>
            <Link href={`${basePath}${s ? `?state=${s}` : ''}`}>{s ? s.toLowerCase().replace(/_/g, ' ') : 'all'}</Link>
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{Number(r.meta.total ?? 0)} request(s)</CardTitle>
          <CardDescription>A submitted request is not an approval; Accounts sees a request only after both approvals.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No requests.
                  </TableCell>
                </TableRow>
              ) : null}
              {r.data.map((x) => (
                <TableRow key={x.id}>
                  <TableCell>
                    <Link className="underline" href={`${basePath}/${x.id}`}>
                      {x.publicRef}
                    </Link>
                    <div className="text-muted-foreground text-xs">{x.itemCount} card event(s)</div>
                  </TableCell>
                  <TableCell>{x.advisor.fullName}</TableCell>
                  <TableCell>{formatInr(x.totalAmountInr)}</TableCell>
                  <TableCell>
                    <PayoutStateBadge state={x.state} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {x.approvals.map((a) => (
                      <Badge key={a.role} variant={a.decision === 'APPROVED' ? 'success' : 'destructive'} className="mr-1">
                        {a.role.toLowerCase()} {a.decision.toLowerCase()}
                      </Badge>
                    ))}
                    {x.outstanding.map((o) => (
                      <Badge key={o} variant="warning" className="mr-1">
                        {o.toLowerCase()} pending
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(x.submittedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
