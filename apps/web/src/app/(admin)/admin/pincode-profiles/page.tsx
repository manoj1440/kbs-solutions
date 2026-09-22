import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface Profile {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
  sheetName: string | null;
  pincodeColumn: string;
  semantics: { rule: string };
  approvedAt: string | null;
  bank: { code: string; displayName: string };
  _count: { batches: number };
}

/** F-404 Admin: bank pincode profiles. */
export default async function PincodeProfilesPage() {
  const p = await apiFetch<Profile[]>('/pincode-profiles');
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Bank pincode profiles</h1>
        <p className="text-muted-foreground text-sm">One profile per bank sheet structure (REQ-07 §7.2). A bank only becomes sourceable for a pincode once its profile is APPROVED and a batch is imported under it. Rules marked “requires bank mapping” never make a pincode available.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
          <CardDescription>{p.data.length} profile versions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sheet · pincode column</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Batches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.bank.displayName}</TableCell>
                  <TableCell>
                    <Link className="underline" href={`/admin/pincode-profiles/${r.id}`}>
                      {r.name}
                    </Link>{' '}
                    <span className="text-muted-foreground text-xs">v{r.version}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'DRAFT' ? 'warning' : 'unknown'}>{r.status}</Badge>
                    {r.approvedAt ? <span className="text-muted-foreground ml-1 text-xs">{formatDateTime(r.approvedAt)}</span> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.sheetName ?? '(first)'} · {r.pincodeColumn}
                  </TableCell>
                  <TableCell className="text-xs">{r.semantics.rule.replace(/_/g, ' ').toLowerCase()}</TableCell>
                  <TableCell>{r._count.batches}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
