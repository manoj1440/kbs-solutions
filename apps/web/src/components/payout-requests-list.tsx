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
  payment: { state: string; paidAt: string; amountInr: number } | null;
  holdReason: string | null;
  paidAt: string | null;
  correctionPending: boolean;
}
interface Queues {
  awaiting: { count: number; amountInr: number };
  paid: { count: number; amountInr: number; confirmedTransferInr: number };
  exceptions: { count: number; amountInr: number };
  asOf: string;
}
const QUEUES = [
  { key: 'awaiting', label: 'Awaiting payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'exceptions', label: 'Exceptions / needs correction' },
] as const;
const STATES = ['', 'PENDING_APPROVALS', 'APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'REJECTED', 'CANCELLED', 'ON_HOLD'];

/** F-603/F-604 — payout requests with outstanding approvals; "awaiting me" shows the viewer's own queue. */
export async function PayoutRequestsList({ basePath, sp: rawSp, title, description, mode = 'approvals' }: { basePath: string; sp: { state?: string; awaitingMe?: string; page?: string; queue?: string }; title: string; description: string; mode?: 'approvals' | 'accounts' }) {
  const qs = new URLSearchParams();
  const sp = mode === 'accounts' && !rawSp.queue && !rawSp.state ? { ...rawSp, queue: 'awaiting' } : rawSp;
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const [r, queues] = await Promise.all([apiFetch<Row[]>(`/payouts/requests?${qs.toString()}`), mode === 'accounts' || sp.queue ? apiFetch<Queues>('/payouts/payments/queues').then((x) => x.data).catch(() => null) : Promise.resolve(null)]);
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {mode === 'accounts' ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {QUEUES.map((q) => (
            <Link key={q.key} href={`${basePath}?queue=${q.key}`} className={`rounded-lg border p-3 transition-colors ${sp.queue === q.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`} aria-current={sp.queue === q.key ? 'page' : undefined}>
              <div className="text-muted-foreground text-xs">{q.label}</div>
              <div className="text-xl font-semibold">{queues ? queues[q.key].count : '—'}</div>
              <div className="text-muted-foreground text-xs">{queues ? (q.key === 'paid' ? `${formatInr(queues.paid.confirmedTransferInr)} confirmed transfers` : formatInr(queues[q.key].amountInr)) : 'unavailable'}</div>
            </Link>
          ))}
        </div>
      ) : (
      <div className="flex flex-wrap gap-1">
        <Button asChild size="sm" variant={sp.awaitingMe === 'true' ? 'default' : 'outline'}>
          <Link href={`${basePath}?awaitingMe=true`}>Awaiting my approval</Link>
        </Button>
        {STATES.map((s) => (
          <Button key={s || 'all'} asChild size="sm" variant={!sp.awaitingMe && (sp.state ?? '') === s ? 'default' : 'outline'}>
            <Link href={`${basePath}${s ? `?state=${s}` : ''}`}>{s ? s.toLowerCase().replace(/_/g, ' ') : 'all'}</Link>
          </Button>
        ))}
        <Button asChild size="sm" variant={sp.queue === 'exceptions' ? 'default' : 'outline'}>
          <Link href={`${basePath}?queue=exceptions`}>payment exceptions</Link>
        </Button>
      </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{Number(r.meta.total ?? 0)} request(s)</CardTitle>
          <CardDescription>{mode === 'accounts' ? 'Only requests approved by both the Manager and the Admin reach Accounts. Pay outside KBS, then record the transfer.' : 'A submitted request is not an approval; Accounts sees a request only after both approvals.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>State</TableHead>
                <TableHead>{mode === 'accounts' ? 'Payment' : 'Approvals'}</TableHead>
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
                  <TableCell data-label="Request">
                    <Link className="underline" href={`${basePath}/${x.id}`}>
                      {x.publicRef}
                    </Link>
                    <div className="text-muted-foreground text-xs">{x.itemCount} card event(s)</div>
                  </TableCell>
                  <TableCell data-label="Advisor">{x.advisor.fullName}</TableCell>
                  <TableCell data-label="Amount" className="whitespace-nowrap">{formatInr(x.totalAmountInr)}</TableCell>
                  <TableCell data-label="State">
                    <PayoutStateBadge state={x.state} />
                  </TableCell>
                  {mode === 'accounts' ? (
                    <TableCell data-label="Payment" className="text-xs">
                      {x.payment ? `${x.payment.state.toLowerCase().replace(/_/g, ' ')} · ${formatInr(x.payment.amountInr)}` : x.state === 'APPROVED' ? 'not yet recorded' : '—'}
                      {x.correctionPending ? (
                        <Badge variant="warning" className="ml-1">
                          correction awaiting Admin
                        </Badge>
                      ) : null}
                      {x.holdReason ? <div className="text-destructive mt-1 whitespace-normal">{x.holdReason}</div> : null}
                    </TableCell>
                  ) : (
                  <TableCell data-label="Approvals" className="text-xs">
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
                    {x.payment ? <div className="text-muted-foreground mt-1">payment {x.payment.state.toLowerCase().replace(/_/g, ' ')}</div> : null}
                    {x.correctionPending ? <Badge variant="warning">correction awaiting Admin</Badge> : null}
                  </TableCell>
                  )}
                  <TableCell data-label="Submitted" className="text-xs">{formatDateTime(x.submittedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
