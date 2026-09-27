import { formatDateTime, OUTCOME_LABELS } from '@kbs/shared';
import {
  ArrowLeftRight,
  CalendarClock,
  Filter,
  MessageSquareText,
  PhoneCall,
  Share2,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { PlayRecordingButton } from '@/components/play-recording-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, MiniStat, SectionCard, type Tone } from '@/components/ui/kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

export interface OverviewRow {
  id: string;
  fullName: string;
  employeeCode: string | null;
  status: string;
  training: string;
  wfhActive: boolean;
  lastLoginAt: string | null;
  queueSize: number;
  followUpsDue: number;
  attempts: number;
  connected: number;
  talkTimeSec: number;
  outcomes: Record<string, number>;
  shares: Record<string, number>;
  interests: number;
}

export function rangeParams(sp: { from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (sp.from) q.set('from', new Date(sp.from).toISOString());
  if (sp.to) q.set('to', new Date(sp.to).toISOString());
  return q.toString();
}

/** Small neutral "label count" chips for per-person breakdowns. */
function Chips({ items }: { items: [string, number][] }) {
  if (!items.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(([k, n]) => (
        <span key={k} className="inline-flex items-baseline gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11.5px] text-slate-700 ring-1 ring-slate-200 ring-inset">
          {k}
          <span className="font-semibold text-slate-900 tabular-nums">{n}</span>
        </span>
      ))}
    </div>
  );
}

/** F-313 §1: team overview — evidence counts with denominators, no ranking. */
export async function TeamOverview({
  base,
  sp,
}: {
  base: string;
  sp: { from?: string; to?: string };
}) {
  const ov = await apiFetch<{ range: { from: string; to: string }; telecallers: OverviewRow[] }>(
    `/calling/team/overview?${rangeParams(sp)}`,
  );
  const rows = ov.data.telecallers;
  return (
    <SectionCard
      icon={Users}
      tone="violet"
      title="Team activity"
      description={`${formatDateTime(ov.data.range.from)} → ${formatDateTime(ov.data.range.to)} · attempts = call rows; connected = provider-confirmed only.`}
      actions={<RangeForm base={base} sp={sp} />}
      flush={rows.length > 0}
    >
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No Telecallers." />
      ) : (
        <TeamActivityTable rows={rows} base={base} sp={sp} />
      )}
    </SectionCard>
  );
}

/** F-313 / F-808 per-caller evidence table (reused by the Admin caller-performance page with an in-page scroll). */
export function TeamActivityTable({
  rows,
  base,
  sp,
  containerClassName,
  headerClassName,
}: {
  rows: OverviewRow[];
  base: string;
  sp: { from?: string; to?: string };
  containerClassName?: string;
  headerClassName?: string;
}) {
  return (
    <Table responsive containerClassName={containerClassName}>
      <TableHeader className={headerClassName}>
        <TableRow>
          <TableHead>Telecaller / status</TableHead>
          <TableHead>Queue / follow-ups</TableHead>
          <TableHead>Call activity</TableHead>
          <TableHead>Outcomes</TableHead>
          <TableHead>Shares</TableHead>
          <TableHead className="sm:text-right">Interests</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => (
          <TableRow key={t.id}>
            <TableCell data-label="Telecaller / status">
              <div className="flex min-w-40 items-start gap-2.5">
                <Avatar name={t.fullName} size="sm" />
                <div className="min-w-0">
                  <a className="font-medium" href={`${base}/telecaller/${t.id}?${rangeParams(sp)}`}>
                    {t.fullName}
                  </a>
                  {t.employeeCode ? <div className="font-mono text-[11px] text-slate-500">{t.employeeCode}</div> : null}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge variant={t.status === 'ACTIVE' ? 'success' : 'unknown'}>{humanize(t.status)}</Badge>
                    <Badge variant={t.training === 'PASSED' ? 'success' : 'warning'}>
                      {t.training === 'PASSED' ? 'trained' : t.training.toLowerCase().replace(/_/g, ' ')}
                    </Badge>
                    {t.wfhActive ? <Badge variant="info">WFH</Badge> : null}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell data-label="Queue / follow-ups">
              <div>
                <span className="font-semibold text-slate-900 tabular-nums">{t.queueSize}</span> in queue
              </div>
              <div className="mt-1">
                {t.followUpsDue ? (
                  <Badge variant="destructive">{t.followUpsDue} follow-ups due</Badge>
                ) : (
                  <span className="text-xs text-slate-500">No follow-ups due</span>
                )}
              </div>
            </TableCell>
            <TableCell data-label="Call activity">
              <div className="tabular-nums">
                <span className="font-semibold text-slate-900">{t.attempts}</span> attempts ·{' '}
                <span className="font-semibold text-slate-900">{t.connected}</span> connected
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">{Math.round(t.talkTimeSec / 60)} min talk time</div>
            </TableCell>
            <TableCell data-label="Outcomes">
              <Chips items={Object.entries(t.outcomes).map(([k, n]) => [OUTCOME_LABELS[k as keyof typeof OUTCOME_LABELS] ?? k, n])} />
            </TableCell>
            <TableCell data-label="Shares">
              <Chips items={Object.entries(t.shares).map(([k, n]) => [k.toLowerCase().replace(/_/g, ' '), n])} />
            </TableCell>
            <TableCell data-label="Interests" className="font-semibold tabular-nums sm:text-right">
              {t.interests}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RangeForm({ base, sp }: { base: string; sp: { from?: string; to?: string } }) {
  const date = 'h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900';
  return (
    <form action={base} method="get" className="flex flex-wrap items-end gap-2 text-xs">
      <label className="grid gap-1 font-medium text-slate-600">
        From
        <input type="date" name="from" defaultValue={sp.from?.slice(0, 10)} className={date} />
      </label>
      <label className="grid gap-1 font-medium text-slate-600">
        To
        <input type="date" name="to" defaultValue={sp.to?.slice(0, 10)} className={date} />
      </label>
      <Button type="submit" variant="outline" size="sm" className="h-9">
        <Filter />
        Apply
      </Button>
    </form>
  );
}

interface Activity {
  telecaller: { id: string; fullName: string; employeeCode: string | null; status: string };
  range: { from: string; to: string };
  queueSize: number;
  attempts: {
    id: string;
    at: string;
    customer: { id: string; fullName: string; mobileMasked: string | null };
    providerState: string;
    durationSec: number | null;
    failureReason: string | null;
    recording: string;
    canPlay: boolean;
  }[];
  outcomes: {
    id: string;
    at: string;
    customer: { id: string; fullName: string };
    outcome: string;
    remarks: string | null;
    followUpAt: string | null;
    card: string | null;
    doNotContact: boolean;
  }[];
  shares: {
    id: string;
    at: string;
    customer: { id: string; fullName: string } | null;
    kind: string;
    card: string | null;
    handoffResult: string;
    deliveryStatus: string;
    targetMobileMasked: string;
  }[];
  remarks: {
    id: string;
    at: string;
    callingRecordId: string;
    text: string;
    editedAt: string | null;
  }[];
  allocations: {
    id: string;
    at: string;
    customer: { id: string; fullName: string };
    direction: 'IN' | 'OUT';
    reason: string;
  }[];
  followUps: {
    id: string;
    fullName: string;
    mobileMasked: string | null;
    dueAt: string | null;
    overdue: boolean;
    interactionStatus: string;
  }[];
}

/** F-313 §2: Telecaller drill-down with recording playback (audited) — Manager team / Admin. */
export async function TelecallerActivity({
  id,
  base,
  sp,
  eyebrow,
}: {
  id: string;
  base: string;
  sp: { from?: string; to?: string };
  eyebrow?: string;
}) {
  const a = (
    await apiFetch<Activity>(`/calling/team/telecallers/${id}/activity?${rangeParams(sp)}`)
  ).data;
  const section = (title: string, desc: string, body: React.ReactNode, sIcon: LucideIcon, tone: Tone, n: number) => (
    <SectionCard icon={sIcon} tone={tone} title={title} description={desc} flush={n > 0}>
      {n > 0 ? body : <EmptyState icon={sIcon} title="Nothing in this range." className="py-6" />}
    </SectionCard>
  );
  const connected = a.attempts.filter((x) => x.providerState === 'ENDED').length;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={a.telecaller.fullName} size="lg" />
          <div className="min-w-0">
            {eyebrow ? <div className="text-[10.5px] font-semibold tracking-[0.16em] text-violet-700 uppercase">{eyebrow}</div> : null}
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{a.telecaller.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge variant={a.telecaller.status === 'ACTIVE' ? 'success' : 'unknown'}>{humanize(a.telecaller.status)}</Badge>
              {a.telecaller.employeeCode ? <span className="font-mono">{a.telecaller.employeeCode}</span> : null}
              <span>
                {formatDateTime(a.range.from)} → {formatDateTime(a.range.to)}
              </span>
            </div>
          </div>
        </div>
        <RangeForm base={`${base}/telecaller/${id}`} sp={sp} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Queue" value={a.queueSize} hint="Records currently assigned" tone="violet" />
        <MiniStat label="Open follow-ups" value={a.followUps.length} hint={`${a.followUps.filter((f) => f.overdue).length} overdue · all time`} tone="amber" />
        <MiniStat label="Call attempts" value={a.attempts.length} hint={`${connected} connected (provider) · in range`} tone="sky" />
        <MiniStat label="Materials shared" value={a.shares.length} hint="In this range" tone="teal" />
      </div>
      {section(
        'Follow-ups',
        'Open follow-ups on this queue (all time).',
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.followUps.map((f) => (
              <TableRow key={f.id}>
                <TableCell data-label="Customer">
                  <span className="font-medium text-slate-800">{f.fullName}</span>{' '}
                  <span className="font-mono text-xs text-slate-500">{f.mobileMasked}</span>
                </TableCell>
                <TableCell data-label="Due" className="text-xs">
                  {f.dueAt ? formatDateTime(f.dueAt) : '—'}{' '}
                  {f.overdue ? <Badge variant="destructive">overdue</Badge> : null}
                </TableCell>
                <TableCell data-label="Status">
                  <Badge variant="secondary">{f.interactionStatus}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>,
        CalendarClock,
        'amber',
        a.followUps.length,
      )}
      {section(
        'Calls',
        `${a.attempts.length} attempts · ${connected} connected (provider-confirmed). Recording chip reflects the provider's recording row; playback is logged.`,
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="sm:text-right">Duration</TableHead>
              <TableHead>Recording</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.attempts.map((c) => (
              <TableRow key={c.id}>
                <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600">
                  {formatDateTime(c.at)}
                </TableCell>
                <TableCell data-label="Customer">
                  <span className="font-medium text-slate-800">{c.customer.fullName}</span>{' '}
                  <span className="font-mono text-xs text-slate-500">{c.customer.mobileMasked}</span>
                </TableCell>
                <TableCell data-label="State">
                  <Badge
                    variant={
                      c.providerState === 'ENDED'
                        ? 'success'
                        : c.providerState === 'FAILED' || c.providerState === 'NO_ANSWER'
                          ? 'destructive'
                          : 'info'
                    }
                  >
                    {c.providerState}
                  </Badge>
                  {c.failureReason ? <span className="ml-1 text-xs text-slate-500">{c.failureReason}</span> : null}
                </TableCell>
                <TableCell data-label="Duration" className="text-xs tabular-nums sm:text-right">
                  {c.durationSec !== null ? `${c.durationSec}s` : '—'}
                </TableCell>
                <TableCell data-label="Recording" className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        c.recording === 'Recording available'
                          ? 'success'
                          : c.recording === 'Recording unavailable'
                            ? 'destructive'
                            : 'unknown'
                      }
                    >
                      {c.recording}
                    </Badge>
                    {c.canPlay ? <PlayRecordingButton callId={c.id} /> : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>,
        PhoneCall,
        'sky',
        a.attempts.length,
      )}
      {section(
        'Outcomes',
        'Operational outcomes as recorded by the Telecaller — never a bank stage.',
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.outcomes.map((o) => (
              <TableRow key={o.id}>
                <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600">
                  {formatDateTime(o.at)}
                </TableCell>
                <TableCell data-label="Customer" className="font-medium text-slate-800">
                  {o.customer.fullName}
                </TableCell>
                <TableCell data-label="Outcome">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary">{OUTCOME_LABELS[o.outcome as keyof typeof OUTCOME_LABELS] ?? o.outcome}</Badge>
                    {o.card ? <span className="text-xs text-slate-600">{o.card}</span> : null}
                    {o.doNotContact ? <Badge variant="destructive">DNC</Badge> : null}
                  </div>
                </TableCell>
                <TableCell data-label="Notes" className="text-xs text-slate-600">
                  {o.remarks ?? '—'}
                  {o.followUpAt ? ` · follow-up ${formatDateTime(o.followUpAt)}` : ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>,
        MessageSquareText,
        'violet',
        a.outcomes.length,
      )}
      {section(
        'Materials shared',
        '"Share sheet opened" is a hand-off, not a delivery confirmation.',
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.shares.map((s) => (
              <TableRow key={s.id}>
                <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600">
                  {formatDateTime(s.at)}
                </TableCell>
                <TableCell data-label="Customer">
                  <span className="font-medium text-slate-800">{s.customer?.fullName ?? '—'}</span>{' '}
                  <span className="font-mono text-xs text-slate-500">{s.targetMobileMasked}</span>
                </TableCell>
                <TableCell data-label="What" className="text-xs">
                  {s.kind.toLowerCase().replace(/_/g, ' ')}
                  {s.card ? ` · ${s.card}` : ''}
                </TableCell>
                <TableCell data-label="Result" className="text-xs">
                  {s.deliveryStatus === 'DELIVERED'
                    ? 'Delivered'
                    : s.deliveryStatus === 'SENT'
                      ? 'Sent'
                      : s.deliveryStatus === 'FAILED'
                        ? 'Delivery failed'
                        : s.handoffResult === 'OPENED'
                          ? 'Share sheet opened'
                          : 'Could not open share sheet'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>,
        Share2,
        'teal',
        a.shares.length,
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard icon={StickyNote} tone="slate" title="Remarks" description="Operational remarks by this Telecaller.">
          {a.remarks.length === 0 ? (
            <EmptyState icon={StickyNote} title="Nothing in this range." className="py-6" />
          ) : (
            <ul className="grid divide-y divide-slate-100 text-sm">
              {a.remarks.map((r) => (
                <li key={r.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="text-[11px] text-slate-500">
                    {formatDateTime(r.at)}
                    {r.editedAt ? ' (edited)' : ''}
                  </div>
                  <div className="text-slate-800">{r.text}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard icon={ArrowLeftRight} tone="violet" title="Allocation history" description="Records moved in or out of this queue.">
          {a.allocations.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="Nothing in this range." className="py-6" />
          ) : (
            <ul className="grid divide-y divide-slate-100 text-sm">
              {a.allocations.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                  <Badge variant={e.direction === 'IN' ? 'success' : 'unknown'}>{e.direction}</Badge>
                  <div className="min-w-0">
                    <div className="text-slate-800">
                      {e.customer.fullName} · {e.reason}
                    </div>
                    <div className="text-[11px] text-slate-500">{formatDateTime(e.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
