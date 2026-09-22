import { formatDateTime, formatInr } from '@kbs/shared';
import Link from 'next/link';

import { PayoutStateBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

export interface EntitlementDto {
  id: string;
  state: string;
  amountInr: number;
  eligibleAt: string;
  triggerField: string;
  triggerFieldValue: string;
  rule: { id: string; name: string; version: number };
  lead: { id: string; publicRef: string; customerFullName: string };
  advisor: { id: string; fullName: string };
  bank: { code: string; displayName: string };
  card: string;
  evidence: { batchRef: string; uploadedAt: string };
  reviewReason: string | null;
  currentRequestId: string | null;
  createdAt: string;
}
export interface LedgerCounts {
  pendingHold: number;
  available: number;
  reserved: number;
  paid: number;
  underReview: number;
  void: number;
  eligible: number;
  availableToClaim: number;
}
const STATES = ['', 'PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED', 'PAID', 'UNDER_REVIEW', 'VOID'];

/**
 * F-602 — entitlement ledger (REQ-17 §17.9: available = eligible − reserved − paid). Every row shows the exact bank
 * value, the rule version and the evidencing batch; the same figures serve Advisor, Manager, Admin and Accounts.
 */
export async function EntitlementsLedger({ basePath, leadHref, sp, title, description }: { basePath: string; leadHref: (leadId: string) => string; sp: { state?: string; bankId?: string; advisorId?: string; page?: string }; title: string; description: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);
  qs.set('pageSize', '50');
  const r = await apiFetch<EntitlementDto[]>(`/payouts/entitlements?${qs.toString()}`);
  const counts = r.meta.counts as LedgerCounts;
  const amounts = r.meta.amounts as Record<string, number>;
  const tiles: [string, number | string][] = [
    ['Eligible (unique card events)', counts.eligible],
    ['Available to claim', `${counts.availableToClaim} · ${formatInr(amounts.available)}`],
    ['Reserved in requests', `${counts.reserved} · ${formatInr(amounts.reserved)}`],
    ['Paid', `${counts.paid} · ${formatInr(amounts.paid)}`],
    ['Pending hold', counts.pendingHold],
    ['Under review (corrections)', counts.underReview],
  ];
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-1">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {STATES.map((s) => (
          <Button key={s || 'all'} asChild size="sm" variant={(sp.state ?? '') === s ? 'default' : 'outline'}>
            <Link href={`${basePath}${s ? `?state=${s}` : ''}`}>{s ? s.toLowerCase().replace(/_/g, ' ') : 'all'}</Link>
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{Number(r.meta.total ?? 0)} entitlement(s)</CardTitle>
          <CardDescription>Created only by MIS evidence matching an approved bank rule; amounts are snapshotted at eligibility and never rewritten.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Bank / card</TableHead>
                <TableHead>Bank value (exact)</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Eligible at</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground text-center">
                    No entitlements.
                  </TableCell>
                </TableRow>
              ) : null}
              {r.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <PayoutStateBadge state={e.state} />
                    {e.reviewReason ? <div className="text-muted-foreground max-w-56 text-xs">{e.reviewReason}</div> : null}
                  </TableCell>
                  <TableCell>
                    <Link className="underline" href={leadHref(e.lead.id)}>
                      {e.lead.publicRef}
                    </Link>
                    <div className="text-muted-foreground text-xs">{e.lead.customerFullName}</div>
                  </TableCell>
                  <TableCell>{e.advisor.fullName}</TableCell>
                  <TableCell className="text-xs">
                    {e.bank.displayName} · {e.card}
                  </TableCell>
                  <TableCell className="text-xs">
                    <code>{e.triggerField}</code> = “{e.triggerFieldValue}”
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.rule.name} v{e.rule.version}
                  </TableCell>
                  <TableCell>{formatInr(e.amountInr)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(e.eligibleAt)}</TableCell>
                  <TableCell className="text-xs">
                    {e.evidence.batchRef} · {formatDateTime(e.evidence.uploadedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
