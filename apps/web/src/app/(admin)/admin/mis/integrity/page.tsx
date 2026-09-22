import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { AcknowledgeValues } from './acknowledge';
import { Quarantine } from './quarantine';

interface BankIntegrity {
  bank: { id: string; code: string; displayName: string };
  lastUploadAt: string | null;
  lastAppliedAt: string | null;
  batches: Record<string, number>;
  rows: { imported: number; matched: number; unmatched: number; invalid: number; conflicted: number; duplicate: number; ignored: number; pending: number };
  newValuesPending: { field: string; values: string[] }[];
  duplicateKeys: number;
  correctionsUnderReview: number;
  leads: { total: number; neverMatched: number; matchedOlderThan7d: number; matchedOlderThan30d: number };
  advisorReferencesNeverMatched: number;
  quarantine: number;
}
interface Profile {
  id: string;
  status: string;
  version: number;
  bank: { id: string };
}

/** F-507 Admin: MIS integrity & freshness (REQ-16 §16.2) — per-bank tiles, pending new values, quarantine. Freshness is per lead. */
export default async function MisIntegrityPage({ searchParams }: { searchParams: Promise<{ bankId?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  const [d, profiles] = await Promise.all([apiFetch<{ generatedAt: string; banks: BankIntegrity[] }>(`/dashboards/mis-integrity?${qs.toString()}`), apiFetch<Profile[]>('/mis/profiles')]);
  const approvedProfile = (bankId: string) => profiles.data.filter((p) => p.bank.id === bankId && p.status === 'APPROVED').sort((a, b) => b.version - a.version)[0] ?? null;
  const tot = d.data.banks.reduce(
    (a, b) => ({ imported: a.imported + b.rows.imported, matched: a.matched + b.rows.matched, quarantine: a.quarantine + b.quarantine, invalid: a.invalid + b.rows.invalid, never: a.never + b.leads.neverMatched, stale: a.stale + b.leads.matchedOlderThan30d, review: a.review + b.correctionsUnderReview, newValues: a.newValues + b.newValuesPending.reduce((n, v) => n + v.values.length, 0) }),
    { imported: 0, matched: 0, quarantine: 0, invalid: 0, never: 0, stale: 0, review: 0, newValues: 0 },
  );
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">MIS integrity & freshness</h1>
        <p className="text-muted-foreground text-sm">Per-bank upload/apply recency, row outcomes, verbatim new values awaiting acknowledgement, duplicate keys, corrections under review. Freshness is measured per lead, never as one global date.</p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="from">Uploads from</Label>
          <Input id="from" name="from" type="date" defaultValue={sp.from ?? ''} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="to">to</Label>
          <Input id="to" name="to" type="date" defaultValue={sp.to ?? ''} />
        </div>
        {sp.bankId ? <input type="hidden" name="bankId" value={sp.bankId} /> : null}
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/admin/mis/integrity">Clear</Link>
        </Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Rows imported', tot.imported],
          ['Rows matched', tot.matched],
          ['In quarantine', tot.quarantine],
          ['Invalid rows', tot.invalid],
          ['Leads never matched', tot.never],
          ['Leads matched > 30 days ago', tot.stale],
          ['New values pending', tot.newValues],
          ['Corrections under review', tot.review],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardHeader className="pb-1">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Per bank</CardTitle>
          <CardDescription>Generated {formatDateTime(d.data.generatedAt)}. Row figures reconcile with batch totals.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Last upload</TableHead>
                <TableHead>Last applied</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Imported / matched</TableHead>
                <TableHead>Unmatched / conflict / invalid / dup / ignored</TableHead>
                <TableHead>Duplicate keys</TableHead>
                <TableHead>Leads never matched</TableHead>
                <TableHead>Matched &gt;7d / &gt;30d</TableHead>
                <TableHead>Advisor refs unverified</TableHead>
                <TableHead>Under review</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.data.banks.map((b) => (
                <TableRow key={b.bank.id}>
                  <TableCell className="font-medium">{b.bank.displayName}</TableCell>
                  <TableCell>{b.lastUploadAt ? formatDateTime(b.lastUploadAt) : <span className="text-muted-foreground">never</span>}</TableCell>
                  <TableCell>{b.lastAppliedAt ? formatDateTime(b.lastAppliedAt) : <span className="text-muted-foreground">never</span>}</TableCell>
                  <TableCell className="text-xs">
                    {Object.entries(b.batches).map(([s, n]) => (
                      <Badge key={s} variant="secondary" className="mr-1">
                        {s.toLowerCase()} {n}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    {b.rows.imported} / {b.rows.matched}
                  </TableCell>
                  <TableCell>
                    {b.rows.unmatched} / {b.rows.conflicted} / {b.rows.invalid} / {b.rows.duplicate} / {b.rows.ignored}
                  </TableCell>
                  <TableCell>{b.duplicateKeys}</TableCell>
                  <TableCell>
                    <Link className="underline" href={`/admin/leads?bankId=${b.bank.id}&misFreshness=never`}>
                      {b.leads.neverMatched} of {b.leads.total}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link className="underline" href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older7d`}>
                      {b.leads.matchedOlderThan7d}
                    </Link>{' '}
                    /{' '}
                    <Link className="underline" href={`/admin/leads?bankId=${b.bank.id}&misFreshness=older30d`}>
                      {b.leads.matchedOlderThan30d}
                    </Link>
                  </TableCell>
                  <TableCell>{b.advisorReferencesNeverMatched}</TableCell>
                  <TableCell>{b.correctionsUnderReview}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/mis?bankId=${b.bank.id}`}>Batches</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {d.data.banks.filter((b) => b.newValuesPending.length).map((b) => (
        <AcknowledgeValues key={b.bank.id} bank={b.bank} profileId={approvedProfile(b.bank.id)?.id ?? null} pending={b.newValuesPending} />
      ))}
      <Quarantine bankId={sp.bankId} />
    </div>
  );
}
