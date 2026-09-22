import { formatDate, formatDateTime, type PayoutRuleView } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { RuleActions } from './actions';

const STATUS: Record<string, 'success' | 'warning' | 'unknown'> = { APPROVED: 'success', DRAFT: 'warning', RETIRED: 'unknown' };

export default async function PayoutRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, versions] = await Promise.all([apiFetch<PayoutRuleView>(`/payouts/rules/${id}`), apiFetch<PayoutRuleView[]>('/payouts/rules')]);
  const rule = r.data;
  const history = versions.data.filter((v) => v.bank.id === rule.bank.id && v.name === rule.name).sort((a, b) => b.version - a.version);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs">{rule.bank.displayName}</p>
          <h1 className="text-2xl font-semibold">
            {rule.name} <span className="text-muted-foreground text-base">v{rule.version}</span> <Badge variant={STATUS[rule.status] ?? 'secondary'}>{rule.status.toLowerCase()}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            <code>{rule.triggerField}</code> ∈ {rule.triggerValues.map((v) => `“${v}”`).join(', ')}
            {rule.productCodePattern ? ` · product /${rule.productCodePattern}/` : ''} · hold {rule.holdDays} day(s) · effective {formatDate(rule.effectiveFrom)} → {rule.effectiveTo ? formatDate(rule.effectiveTo) : 'open'}
          </p>
          {rule.approvedAt ? (
            <p className="text-muted-foreground text-xs">
              Approved {formatDateTime(rule.approvedAt)} by {rule.approvedBy?.fullName ?? '—'}
            </p>
          ) : null}
          {rule.notes ? <p className="text-sm">{rule.notes}</p> : null}
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/payouts/rules">← All rules</Link>
        </Button>
      </div>
      <RuleActions rule={rule} />
      <Card>
        <CardHeader>
          <CardTitle>Rates</CardTitle>
          <CardDescription>The approved rate in force at the moment a card event becomes eligible is snapshotted on the entitlement; later changes never alter it (REQ-17 §17.9).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rule.rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No rate yet — the rule cannot price an entitlement until a rate is approved.
                  </TableCell>
                </TableRow>
              ) : null}
              {rule.rates.map((x) => (
                <TableRow key={x.id} data-current={rule.currentRate?.id === x.id || undefined}>
                  <TableCell>
                    ₹{x.amountInr.toLocaleString('en-IN')} {rule.currentRate?.id === x.id ? <Badge variant="info">in force</Badge> : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(x.effectiveFrom)} → {x.effectiveTo ? formatDate(x.effectiveTo) : 'open'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS[x.status] ?? 'secondary'}>{x.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{x.approvedAt ? `${formatDateTime(x.approvedAt)} · ${x.approvedBy?.fullName ?? '—'}` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          {history.map((v) => (
            <p key={v.id}>
              <Link className="underline" href={`/admin/payouts/rules/${v.id}`}>
                v{v.version}
              </Link>{' '}
              <Badge variant={STATUS[v.status] ?? 'secondary'}>{v.status.toLowerCase()}</Badge> <span className="text-muted-foreground text-xs">created {formatDateTime(v.createdAt)} · {v.entitlementCount} entitlement(s)</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
