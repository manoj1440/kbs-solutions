import { type CallingRecordsSummary, formatDateTime, formatInr, type LeadStatusRow, RECORD_STATUS_LABELS } from '@kbs/shared';
import { Inbox, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActivationBadge, DecisionBadge, StageBadge } from '@/components/status';
import { BankMark, Callout, EmptyState, MiniStat, type Tone } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError, apiFetch } from '@/lib/api';

export const metadata = { title: 'Business overview · KBS Solutions' };

interface Tot {
  count: number;
  amountInr: number;
}
interface Home {
  people: Record<'TELECALLER' | 'MANAGER' | 'ADVISOR' | 'ACCOUNTS', { total: number; active: number }>;
  calling: CallingRecordsSummary;
  mis: {
    total: number;
    approved: number;
    declined: number;
    inProcess: number;
    decisionBlank: number;
    cardsActive: number;
    cardsInactive: number;
    activationBlank: number;
  };
  leads: { total: number; matched: number; awaitingMis: number };
  payouts: { eligible: Tot; approvedUnpaid: Tot; paid: Tot; confirmedTransfersInr: number };
  catalogue: { banks: { total: number; active: number }; cards: { total: number; published: number } };
  recentLeads: LeadStatusRow[];
  asOf: string;
  note: string;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="shrink-0 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{children}</p>;
}

/**
 * F-811 Business overview: the Admin home. Cumulative, business-first figures — team, calling records, bank MIS,
 * payouts and catalogue — plus the newest leads. Bank figures are the latest accepted MIS values as reported
 * (INV-01..03); every tile names its source.
 */
export default async function AdminHome() {
  let home: Home;
  try {
    home = (await apiFetch<Home>('/dashboards/admin/home')).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login?next=%2Fadmin');
    return (
      <div className="flex flex-col gap-3">
        <h1 className="sr-only">Business overview</h1>
        <Callout tone="warning" icon={TriangleAlert} role="alert" title="Dashboard data could not be loaded.">
          Refresh to retry. Unavailable figures are not zero.
        </Callout>
      </div>
    );
  }

  const { people, calling, mis, leads, payouts, catalogue, recentLeads } = home;
  const c = calling.byStatus;
  const teamTiles: { label: string; role: keyof typeof people; href: string; tone: Tone }[] = [
    { label: 'Telecallers', role: 'TELECALLER', href: '/admin/users?role=TELECALLER', tone: 'sky' },
    { label: 'Managers', role: 'MANAGER', href: '/admin/users?role=MANAGER', tone: 'indigo' },
    { label: 'Advisors', role: 'ADVISOR', href: '/admin/users?role=ADVISOR', tone: 'violet' },
    { label: 'Accounts', role: 'ACCOUNTS', href: '/admin/users?role=ACCOUNTS', tone: 'slate' },
  ];
  const callingTiles: { label: string; value: number; hint?: string; href?: string; tone: Tone }[] = [
    { label: 'Customer records', value: calling.total, hint: `${calling.batches.total} uploads · calling list`, href: '/admin/calling-list', tone: 'sky' },
    { label: 'Called at least once', value: calling.attempted, hint: `${calling.connected} connected · telephony`, tone: 'indigo' },
    { label: RECORD_STATUS_LABELS.UNTOUCHED, value: c.UNTOUCHED, hint: 'Calling list', tone: 'slate' },
    { label: RECORD_STATUS_LABELS.UNASSIGNED, value: c.UNASSIGNED, hint: 'Calling list', tone: 'slate' },
    { label: RECORD_STATUS_LABELS.UNREACHABLE, value: c.UNREACHABLE, hint: 'Calling list', tone: 'amber' },
    { label: RECORD_STATUS_LABELS.FOLLOW_UP, value: c.FOLLOW_UP, hint: `${calling.followUpsDue} due now`, tone: 'violet' },
    { label: 'Interested / link shared', value: c.INTERESTED + c.LINK_SHARED, hint: 'Furthest KBS-known step', tone: 'teal' },
    { label: 'Declined / closed', value: c.DECLINED + c.COMPLETED + c.DO_NOT_CONTACT, hint: 'Not interested, completed, do-not-contact', tone: 'rose' },
  ];

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Business overview</h1>

      <Eyebrow>Team</Eyebrow>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        {teamTiles.map((t) => (
          <MiniStat key={t.role} label={t.label} value={people[t.role].total} hint={`${people[t.role].active} active`} href={t.href} tone={t.tone} />
        ))}
      </div>

      <Eyebrow>Calling</Eyebrow>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {callingTiles.map((t) => (
          <MiniStat key={t.label} label={t.label} value={t.value} hint={t.hint} href={t.href} tone={t.tone} />
        ))}
      </div>

      <Eyebrow>Bank MIS &amp; payouts</Eyebrow>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <MiniStat label="Applications reported" value={mis.total} hint="Latest bank-reported state per application" href="/admin/mis" tone="sky" />
        <MiniStat label="Approved" value={mis.approved} hint="Bank MIS · decision" tone="emerald" />
        <MiniStat label="In process" value={mis.inProcess} hint="Bank MIS · decision" tone="amber" />
        <MiniStat label="Declined" value={mis.declined} hint="Bank MIS · decision" tone="rose" />
        <MiniStat label="Cards active" value={mis.cardsActive} hint={`${mis.cardsInactive} inactive · ${mis.activationBlank} not reported`} tone="teal" />
        <MiniStat label="Leads awaiting MIS" value={leads.awaitingMis} hint={`${leads.total} leads total`} href="/admin/leads" tone="indigo" />
        <MiniStat label="Payout earned" value={formatInr(payouts.eligible.amountInr)} hint={`${payouts.eligible.count} card events · ${formatInr(payouts.paid.amountInr)} paid`} href="/admin/payouts/entitlements" tone="amber" />
        <MiniStat label="Banks / cards configured" value={`${catalogue.banks.active} / ${catalogue.cards.published}`} hint={`${catalogue.banks.total} banks · ${catalogue.cards.total} cards in catalogue`} href="/admin/catalogue" tone="slate" />
      </div>

      <section aria-label="Recent leads" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Recent leads</h2>
          <Link href="/admin/leads" className="ml-auto text-xs font-semibold text-teal-800 hover:underline">
            All leads →
          </Link>
        </div>
        <div className="min-h-0 flex-1">
          {recentLeads.length === 0 ? (
            <EmptyState icon={Inbox} className="m-3" title="No leads yet." description="Leads appear here as Advisors create them." />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead>Bank / card</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Card activation</TableHead>
                  <TableHead className="pr-4">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-4" data-label="Customer">
                      <Link href={`/admin/leads/${l.id}`} className="text-xs font-medium text-teal-700 hover:underline">
                        {l.customer.name}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {l.kbsRef}
                        {l.customer.mobileMasked ? ` · ${l.customer.mobileMasked}` : ''}
                      </div>
                    </TableCell>
                    <TableCell data-label="Bank / card">
                      <span className="inline-flex items-center gap-2">
                        <BankMark code={l.bank.code} size="sm" />
                        <span className="text-xs font-medium text-slate-700">{l.bank.code}</span>
                      </span>
                      <div className="mt-0.5 max-w-40 truncate text-[11px] text-slate-500">{l.card.name}</div>
                    </TableCell>
                    <TableCell data-label="Stage">
                      <StageBadge field={l.stage} label={null} />
                    </TableCell>
                    <TableCell data-label="Decision">
                      <DecisionBadge field={l.decision} label={null} />
                    </TableCell>
                    <TableCell data-label="Card activation">
                      <ActivationBadge field={l.activation} label={null} />
                    </TableCell>
                    <TableCell className="pr-4" data-label="Created">
                      <div className="text-xs text-slate-700">{formatDateTime(l.leadCreatedAt)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{l.lastMatchedAt ? `MIS ${formatDateTime(l.lastMatchedAt)}` : 'Awaiting MIS'}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <p className="shrink-0 border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500">
          Source: KBS records + latest accepted bank MIS + payout ledger · as of {formatDateTime(home.asOf)}. {home.note}
        </p>
      </section>
    </div>
  );
}
