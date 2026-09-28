import { type CallingRecordsSummary, formatDateTime, formatInr, type LeadStatusRow, RECORD_STATUS_LABELS } from '@kbs/shared';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Calculator,
  CalendarClock,
  CircleSlash,
  CircleX,
  Clock3,
  CreditCard,
  FileText,
  Headset,
  Hourglass,
  Inbox,
  Landmark,
  ListChecks,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Sparkles,
  TriangleAlert,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActivationBadge, DecisionBadge, StageBadge } from '@/components/status';
import { BankMark, Callout, EmptyState, IconTile, Meter, StatCard, TONE, type Tone } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

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

/** Tinted stat tile: icon + label on top, tone-coloured value, optional share-of-total meter. */
function Stat({ label, value, hint, icon, tone, href, share }: { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone: Tone; href?: string; share?: { value: number; max: number } }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] leading-tight font-medium text-slate-600">{label}</span>
        <IconTile icon={icon} tone={tone} size="sm" />
      </div>
      <div className={cn('mt-1.5 text-2xl font-semibold tracking-tight tabular-nums', TONE[tone].text)}>{value}</div>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      {share ? <Meter value={share.value} max={Math.max(1, share.max)} tone={tone} className="mt-2 h-1.5" label={label} /> : null}
    </>
  );
  const cls = cn('group block rounded-2xl p-3.5 ring-1 ring-slate-200/70 ring-inset transition-shadow', TONE[tone].soft, href && 'hover:shadow-md hover:ring-slate-300');
  return href ? (
    <Link href={href} prefetch={false} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({ title, caption, icon, tone, href, linkLabel, children }: { title: string; caption: string; icon: LucideIcon; tone: Tone; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <IconTile icon={icon} tone={tone} size="sm" />
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">{caption}</span>
        <Link href={href} className="ml-auto text-xs font-semibold text-teal-800 hover:underline">
          {linkLabel} →
        </Link>
      </div>
      {children}
    </section>
  );
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
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Business overview</h1>
        <Callout tone="warning" icon={TriangleAlert} role="alert" title="Dashboard data could not be loaded.">
          Refresh to retry. Unavailable figures are not zero.
        </Callout>
      </div>
    );
  }

  const { people, calling, mis, leads, payouts, catalogue, recentLeads } = home;
  const c = calling.byStatus;
  const teamTiles: { label: string; role: keyof typeof people; href: string; icon: LucideIcon }[] = [
    { label: 'Telecallers', role: 'TELECALLER', href: '/admin/users?role=TELECALLER', icon: Headset },
    { label: 'Managers', role: 'MANAGER', href: '/admin/users?role=MANAGER', icon: UserCog },
    { label: 'Advisors', role: 'ADVISOR', href: '/admin/users?role=ADVISOR', icon: BriefcaseBusiness },
    { label: 'Accounts', role: 'ACCOUNTS', href: '/admin/users?role=ACCOUNTS', icon: Calculator },
  ];
  const callingTiles: { label: string; value: number; hint?: string; icon: LucideIcon; tone: Tone; href?: string; share?: { value: number; max: number } }[] = [
    { label: 'Customer records', value: calling.total, hint: `${calling.batches.total} uploads`, icon: Users, tone: 'sky', href: '/admin/calling-list' },
    { label: 'Called at least once', value: calling.attempted, hint: `${calling.connected} connected`, icon: PhoneOutgoing, tone: 'indigo', share: { value: calling.attempted, max: calling.total } },
    { label: RECORD_STATUS_LABELS.UNTOUCHED, value: c.UNTOUCHED, icon: PhoneMissed, tone: 'slate', share: { value: c.UNTOUCHED, max: calling.total } },
    { label: RECORD_STATUS_LABELS.UNASSIGNED, value: c.UNASSIGNED, icon: UserPlus, tone: 'slate', share: { value: c.UNASSIGNED, max: calling.total } },
    { label: RECORD_STATUS_LABELS.UNREACHABLE, value: c.UNREACHABLE, icon: PhoneOff, tone: 'amber', share: { value: c.UNREACHABLE, max: calling.total } },
    { label: RECORD_STATUS_LABELS.FOLLOW_UP, value: c.FOLLOW_UP, hint: `${calling.followUpsDue} due now`, icon: CalendarClock, tone: 'violet', share: { value: c.FOLLOW_UP, max: calling.total } },
    { label: 'Interested / link shared', value: c.INTERESTED + c.LINK_SHARED, hint: 'Furthest KBS-known step', icon: Sparkles, tone: 'teal', share: { value: c.INTERESTED + c.LINK_SHARED, max: calling.total } },
    { label: 'Declined / closed', value: c.DECLINED + c.COMPLETED + c.DO_NOT_CONTACT, hint: 'Not interested, completed, do-not-contact', icon: CircleSlash, tone: 'rose', share: { value: c.DECLINED + c.COMPLETED + c.DO_NOT_CONTACT, max: calling.total } },
  ];
  const misTiles: { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone: Tone; href?: string; share?: { value: number; max: number } }[] = [
    { label: 'Applications reported', value: mis.total, hint: 'Latest bank-reported state per application', icon: FileText, tone: 'sky', href: '/admin/mis' },
    { label: 'Approved', value: mis.approved, hint: 'Bank MIS · decision', icon: BadgeCheck, tone: 'emerald', share: { value: mis.approved, max: mis.total } },
    { label: 'In process', value: mis.inProcess, hint: 'Bank MIS · decision', icon: Clock3, tone: 'amber', share: { value: mis.inProcess, max: mis.total } },
    { label: 'Declined', value: mis.declined, hint: 'Bank MIS · decision', icon: CircleX, tone: 'rose', share: { value: mis.declined, max: mis.total } },
    { label: 'Cards active', value: mis.cardsActive, hint: `${mis.cardsInactive} inactive · ${mis.activationBlank} not reported`, icon: CreditCard, tone: 'teal', share: { value: mis.cardsActive, max: mis.total } },
    { label: 'Leads awaiting MIS', value: leads.awaitingMis, hint: `${leads.total} leads total`, icon: Hourglass, tone: 'indigo', href: '/admin/leads', share: { value: leads.awaitingMis, max: leads.total } },
    { label: 'Payout earned', value: formatInr(payouts.eligible.amountInr), hint: `${payouts.eligible.count} card events · ${formatInr(payouts.paid.amountInr)} paid`, icon: Wallet, tone: 'amber', href: '/admin/payouts/entitlements' },
    { label: 'Banks / cards configured', value: `${catalogue.banks.active} / ${catalogue.cards.published}`, hint: `${catalogue.banks.total} banks · ${catalogue.cards.total} cards in catalogue`, icon: Landmark, tone: 'violet', href: '/admin/catalogue' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Business overview</h1>
        <p className="text-xs text-slate-500">Cumulative figures · as of {formatDateTime(home.asOf)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {teamTiles.map((t) => (
          <StatCard key={t.role} emphasis label={t.label} value={people[t.role].total} hint={`${people[t.role].active} active`} icon={t.icon} href={t.href} />
        ))}
      </div>

      <Panel title="Calling" caption="Every customer record · statuses are exclusive" icon={PhoneCall} tone="sky" href="/admin/calling-list" linkLabel="Calling records">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {callingTiles.map((t) => (
            <Stat key={t.label} {...t} />
          ))}
        </div>
      </Panel>

      <Panel title="Bank MIS & payouts" caption="Latest accepted MIS only · never live bank status" icon={Landmark} tone="emerald" href="/admin/mis" linkLabel="Bank MIS">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {misTiles.map((t) => (
            <Stat key={t.label} {...t} />
          ))}
        </div>
      </Panel>

      <section aria-label="Recent leads" className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
          <IconTile icon={ListChecks} tone="teal" size="sm" />
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Recent leads</h2>
          <span className="text-xs text-slate-500">10 newest · bank values verbatim</span>
          <Link href="/admin/leads" className="ml-auto text-xs font-semibold text-teal-800 hover:underline">
            All leads →
          </Link>
        </div>
        {recentLeads.length === 0 ? (
          <EmptyState icon={Inbox} className="m-3" title="No leads yet." description="Leads appear here as Advisors create them." />
        ) : (
          <Table responsive containerClassName="rounded-none! border-0!">
            <TableHeader>
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
                <TableRow key={l.id} className="hover:bg-slate-50">
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
        <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500">
          Source: KBS records + latest accepted bank MIS + payout ledger · as of {formatDateTime(home.asOf)}. {home.note}
        </p>
      </section>
    </div>
  );
}
