import { formatDate, formatDateTime, type PayoutRuleView } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { NewRule } from './new-rule';

interface Bank {
  id: string;
  code: string;
  displayName: string;
}
const STATUS: Record<string, 'success' | 'warning' | 'unknown'> = { APPROVED: 'success', DRAFT: 'warning', RETIRED: 'unknown' };

/** F-601 Admin: payout rules per bank (versioned) — no rule means nothing is ever eligible (PAY-01). */
export default async function PayoutRulesPage() {
  const [rules, banks] = await Promise.all([apiFetch<PayoutRuleView[]>('/payouts/rules'), apiFetch<Bank[]>('/catalogue/banks')]);
  const approvedBanks = new Set(rules.data.filter((r) => r.status === 'APPROVED').map((r) => r.bank.id));
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Payout rules</h1>
        <p className="text-muted-foreground text-sm">A bank pays out only when an approved rule says which exact MIS value triggers it and an approved rate prices it. Banks without an approved rule never produce entitlements.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {banks.data.map((b) => (
          <Badge key={b.id} variant={approvedBanks.has(b.id) ? 'success' : 'unknown'}>
            {b.code} {approvedBanks.has(b.id) ? 'rule approved' : 'no approved rule'}
          </Badge>
        ))}
      </div>
      <NewRule banks={banks.data} />
      <Card>
        <CardHeader>
          <CardTitle>Rules ({rules.data.length})</CardTitle>
          <CardDescription>Every version is kept; approving a newer version retires the older one. Rate changes never rewrite existing entitlements.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Hold</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Current rate</TableHead>
                <TableHead>Entitlements</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground text-center">
                    No payout rules yet — nothing is eligible until one is approved.
                  </TableCell>
                </TableRow>
              ) : null}
              {rules.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.bank.displayName}</TableCell>
                  <TableCell>
                    <Link className="underline" href={`/admin/payouts/rules/${r.id}`}>
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>v{r.version}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS[r.status] ?? 'secondary'}>{r.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <code>{r.triggerField}</code> ∈ {r.triggerValues.map((v) => `“${v}”`).join(', ')}
                    {r.productCodePattern ? ` · product /${r.productCodePattern}/` : ''}
                  </TableCell>
                  <TableCell>{r.holdDays} d</TableCell>
                  <TableCell className="text-xs">
                    {formatDate(r.effectiveFrom)} → {r.effectiveTo ? formatDate(r.effectiveTo) : 'open'}
                  </TableCell>
                  <TableCell>{r.currentRate ? `₹${r.currentRate.amountInr.toLocaleString('en-IN')}` : <span className="text-muted-foreground">none approved</span>}</TableCell>
                  <TableCell>{r.entitlementCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rules.data.length ? <p className="text-muted-foreground mt-2 text-xs">Approvals are audited with a reason. Latest approval: {formatDateTime(rules.data.map((r) => r.approvedAt).filter(Boolean).sort().at(-1) ?? null) || '—'}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
