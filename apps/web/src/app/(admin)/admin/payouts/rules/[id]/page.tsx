import { formatDate, formatDateTime, type PayoutRuleView } from '@kbs/shared';
import { BadgeIndianRupee, FileText, GitBranch, Hourglass, IndianRupee, ListChecks, Settings2 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BankMark, EmptyState, humanize, KeyValueGrid, PageHeader, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { RuleActions } from './actions';

const STATUS: Record<string, 'success' | 'warning' | 'unknown'> = {
  APPROVED: 'success',
  DRAFT: 'warning',
  RETIRED: 'unknown',
};

export default async function PayoutRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, versions] = await Promise.all([apiFetch<PayoutRuleView>(`/payouts/rules/${id}`), apiFetch<PayoutRuleView[]>('/payouts/rules')]);
  const rule = r.data;
  const history = versions.data.filter((v) => v.bank.id === rule.bank.id && v.name === rule.name).sort((a, b) => b.version - a.version);
  const draftRates = rule.rates.filter((x) => x.status === 'DRAFT').length;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Settings2}
        eyebrow="Bank data & finance"
        title={rule.name}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <BankMark code={rule.bank.code} size="sm" />
              {rule.bank.displayName}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 tabular-nums">v{rule.version}</span>
            <Badge variant={STATUS[rule.status] ?? 'secondary'}>{humanize(rule.status)}</Badge>
          </>
        }
        description={
          <>
            <code>{rule.triggerField}</code> ∈ {rule.triggerValues.map((v) => `“${v}”`).join(', ')}
            {rule.productCodePattern ? ` · product /${rule.productCodePattern}/` : ''} · hold {rule.holdDays} day(s) · effective {formatDate(rule.effectiveFrom)} → {rule.effectiveTo ? formatDate(rule.effectiveTo) : 'open'}
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/payouts/rules">← All rules</Link>
          </Button>
        }
      >
        <StatGrid>
          <StatCard emphasis label="Rate in force" value={rule.currentRate ? `₹${rule.currentRate.amountInr.toLocaleString('en-IN')}` : '—'} hint={rule.currentRate ? `Since ${formatDate(rule.currentRate.effectiveFrom)}` : 'none approved'} icon={IndianRupee} />
          <StatCard label="Entitlements" value={rule.entitlementCount} hint="Created under this version" icon={ListChecks} tone="indigo" />
          <StatCard label="Rates" value={rule.rates.length} hint={draftRates ? `${draftRates} draft awaiting approval` : 'No drafts waiting'} icon={BadgeIndianRupee} tone={draftRates ? 'amber' : 'teal'} />
          <StatCard label="Hold days" value={rule.holdDays} hint="Before an event becomes claimable" icon={Hourglass} tone="slate" />
        </StatGrid>
      </PageHeader>
      <RuleActions rule={rule} />
      <SectionCard icon={IndianRupee} tone="teal" title="Rates" description="The approved rate in force at the moment a card event becomes eligible is snapshotted on the entitlement; later changes never alter it (REQ-17 §17.9)." flush={rule.rates.length > 0}>
        {rule.rates.length === 0 ? (
          <EmptyState icon={IndianRupee} title="No rate yet — the rule cannot price an entitlement until a rate is approved." />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Effective</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rule.rates.map((x) => (
                <TableRow key={x.id} data-current={rule.currentRate?.id === x.id || undefined} className={cn(rule.currentRate?.id === x.id && 'bg-teal-50/40')}>
                  <TableCell data-label="Effective" className="text-xs">
                    {formatDate(x.effectiveFrom)} → {x.effectiveTo ? formatDate(x.effectiveTo) : 'open'}
                  </TableCell>
                  <TableCell data-label="Status">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <Badge variant={STATUS[x.status] ?? 'secondary'}>{humanize(x.status)}</Badge>
                      {rule.currentRate?.id === x.id ? <Badge variant="info">in force</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell data-label="Approved" className="text-xs text-slate-600">
                    {x.approvedAt ? `${formatDateTime(x.approvedAt)} · ${x.approvedBy?.fullName ?? '—'}` : '—'}
                  </TableCell>
                  <TableCell data-label="Amount" className="text-[15px] font-semibold text-slate-900 tabular-nums sm:text-right">
                    ₹{x.amountInr.toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard icon={FileText} tone="indigo" title="Rule definition">
          <KeyValueGrid
            items={[
              ['Trigger field', <code key="f">{rule.triggerField}</code>],
              [
                'Trigger values',
                <span key="v" className="flex flex-wrap gap-1">
                  {rule.triggerValues.map((v) => (
                    <code key={v} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">
                      “{v}”
                    </code>
                  ))}
                </span>,
              ],
              ['Product code pattern', rule.productCodePattern ? <code key="p">/{rule.productCodePattern}/</code> : '—'],
              ['Hold', `${rule.holdDays} day(s)`],
              ['Effective', `${formatDate(rule.effectiveFrom)} → ${rule.effectiveTo ? formatDate(rule.effectiveTo) : 'open'}`],
              ['Approved', rule.approvedAt ? `Approved ${formatDateTime(rule.approvedAt)} by ${rule.approvedBy?.fullName ?? '—'}` : '—'],
            ]}
          />
          {rule.notes ? <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{rule.notes}</p> : null}
        </SectionCard>
        <SectionCard icon={GitBranch} tone="violet" title="Version history">
          <ol className="grid gap-0">
            {history.map((v) => (
              <li key={v.id} className="relative flex gap-3 pb-4 last:pb-0">
                <span aria-hidden="true" className={cn('relative z-10 mt-1 size-3 shrink-0 rounded-full ring-4 ring-white', v.id === rule.id ? 'bg-teal-600' : 'bg-slate-300')} />
                <span aria-hidden="true" className="absolute top-4 bottom-0 left-[5px] w-0.5 bg-slate-100 [li:last-child>&]:hidden" />
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="font-semibold" href={`/admin/payouts/rules/${v.id}`}>
                      v{v.version}
                    </Link>
                    <Badge variant={STATUS[v.status] ?? 'secondary'}>{humanize(v.status)}</Badge>
                  </div>
                  <span className="text-xs text-slate-500">
                    created {formatDateTime(v.createdAt)} · {v.entitlementCount} entitlement(s)
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
