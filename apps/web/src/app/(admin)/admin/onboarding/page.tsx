import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface Row {
  userId: string;
  publicRef: string;
  fullName: string;
  email: string | null;
  submittedAt: string | null;
  identityStatus: string;
  bankName: string | null;
  accountLast4: string | null;
}

/** F-401 §8: Advisor onboarding review queue. */
export default async function OnboardingQueuePage() {
  const q = await apiFetch<Row[]>('/onboarding/review');
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Advisor onboarding review</h1>
        <p className="text-muted-foreground text-sm">Identity shows the provider result only; bank details are masked and every reveal is logged.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Awaiting review</CardTitle>
          <CardDescription>{q.data.length} submissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Advisor</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Identity</TableHead>
                <TableHead>Bank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>
                    <Link className="underline" href={`/admin/onboarding/${r.userId}`}>
                      {r.fullName || '(no name)'}
                    </Link>
                    <span className="text-muted-foreground ml-1 font-mono text-xs">{r.publicRef}</span>
                    <div className="text-muted-foreground text-xs">{r.email}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.submittedAt ? formatDateTime(r.submittedAt) : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={r.identityStatus === 'VERIFIED' ? 'success' : 'warning'}>{r.identityStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.bankName} ••••{r.accountLast4}
                  </TableCell>
                </TableRow>
              ))}
              {q.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    Nothing awaiting review.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
