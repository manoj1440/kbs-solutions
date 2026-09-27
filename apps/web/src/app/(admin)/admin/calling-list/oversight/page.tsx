import { formatDateTime, OVERSIGHT_ATTENTION, OVERSIGHT_ATTENTION_LABELS, type OversightAttention } from '@kbs/shared';
import { Activity, AlarmClock, CircleCheck, Filter, type LucideIcon, MessageCircle, MessageSquareX, Mic, MicOff, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { PlayRecordingButton } from '@/components/play-recording-button';
import { CallerPerformanceNav } from '@/components/caller-performance-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, Meter, PageHeader, PillNav, SectionCard, selectClass, StatCard, StatGrid } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Summary {
  range: { fromDay: string; toDay: string };
  dateBasis: { calls: string; shares: string };
  thresholds: { liveWindowMinutes: number; recordingOverdueMinutes: number };
  calls: { initiated: number; providerConfirmed: number; failedBeforeProvider: number; byState: Record<string, number>; connected: number; talkTimeSec: number; topFailureReasons: { reason: string; count: number }[] };
  recordings: { denominator: number; available: number; pending: number; failed: number; noneRecorded: number; overdue: number };
  shares: { total: number; byKind: Record<string, number>; handoffOpened: number; handoffFailed: number; deliveryNotReported: number; provider: { sent: number; delivered: number; failed: number; awaiting: number } };
  attention: Record<OversightAttention, number>;
}
interface CallRow {
  id: string;
  initiatedAt: string;
  telecaller: { id: string; fullName: string; employeeCode: string | null };
  customer: { id: string; fullName: string; mobileMasked: string };
  providerKey: string;
  providerCallId: string | null;
  providerState: string;
  connectedAt: string | null;
  durationSec: number | null;
  failureReason: string | null;
  recording: string;
  recordingFailureReason: string | null;
  canPlay: boolean;
  attention: OversightAttention[];
}
interface ShareRow {
  id: string;
  at: string;
  actor: { id: string; fullName: string; role: string };
  customer: { type: 'CALLING_RECORD' | 'LEAD'; fullName: string; ref: string | null } | null;
  kind: string;
  card: { name: string } | null;
  assetVersionRef: string | null;
  targetMobileMasked: string;
  channel: string;
  deliveryLabel: string;
  attention: OversightAttention[];
}
interface UserOpt {
  id: string;
  fullName: string;
}

const ATTENTION_ICON: Record<OversightAttention, LucideIcon> = {
  NO_PROVIDER_CONFIRMATION: PhoneOff,
  FAILED_BEFORE_PROVIDER: PhoneMissed,
  RECORDING_FAILED: MicOff,
  RECORDING_OVERDUE: AlarmClock,
  SHARE_FAILED: MessageSquareX,
};
const STATE_TONE: Record<string, 'emerald' | 'rose' | 'amber' | 'sky' | 'slate'> = { REQUESTED: 'slate', RINGING: 'sky', CONNECTED: 'sky', ENDED: 'emerald', FAILED: 'rose', NO_ANSWER: 'amber', UNKNOWN: 'slate' };
const labelCls = 'grid min-w-0 gap-1.5 text-[12px] font-medium text-slate-600';

const KIND_LABEL: Record<string, string> = { BENEFIT_PDF: 'Benefit PDF', OFFICE_ID: 'Office ID', APPLICATION_LINK: 'Application link' };
const STATE_LABEL: Record<string, string> = { REQUESTED: 'Requested', RINGING: 'Ringing', CONNECTED: 'Connected', ENDED: 'Ended (connected)', FAILED: 'Failed', NO_ANSWER: 'No answer', UNKNOWN: 'Unknown' };
const SHARE_ATTENTION: OversightAttention = 'SHARE_FAILED';
const FILTER_KEYS = ['from', 'to', 'managerId', 'telecallerId', 'state', 'recording', 'attention', 'delivery', 'channel', 'kind', 'tab', 'page'] as const;

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
const mins = (sec: number) => `${Math.floor(sec / 60)}m ${sec % 60}s`;
const stateVariant = (s: string) => (s === 'ENDED' ? 'success' : s === 'FAILED' ? 'destructive' : s === 'NO_ANSWER' ? 'warning' : 'unknown');
const recVariant = (r: string) => (r === 'Recording available' ? 'success' : r === 'Recording unavailable' ? 'destructive' : r === 'Recording pending' ? 'warning' : 'unknown');
const deliveryVariant = (l: string) => (l.startsWith('Delivered') || l.startsWith('Sent') ? 'success' : l.includes('failed') || l.startsWith('Could not') ? 'destructive' : 'unknown');

/**
 * F-314: organisation-wide telephony / WhatsApp delivery / recording oversight (REQ-25 §25.4, REQ-16 §16.1).
 * Read-only evidence; provider-confirmed facts only; playback goes through the audited recording endpoint.
 */
export default async function OversightPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'shares' || sp.attention === SHARE_ATTENTION ? 'shares' : 'calls';
  const base = new URLSearchParams();
  for (const k of ['from', 'to', 'managerId'] as const) if (sp[k]) base.set(k, sp[k] as string);
  const summaryQs = new URLSearchParams(base);
  if (sp.telecallerId) summaryQs.set('telecallerId', sp.telecallerId);
  const listQs = new URLSearchParams(base);
  listQs.set('page', sp.page ?? '1');
  listQs.set('pageSize', '25');
  if (tab === 'calls') {
    if (sp.telecallerId) listQs.set('telecallerId', sp.telecallerId);
    for (const k of ['state', 'recording', 'attention'] as const) if (sp[k]) listQs.set(k, sp[k] as string);
  } else {
    if (sp.telecallerId) listQs.set('actorId', sp.telecallerId);
    for (const k of ['delivery', 'channel', 'kind', 'attention'] as const) if (sp[k]) listQs.set(k, sp[k] as string);
  }
  const [summary, list, telecallers, managers] = await Promise.all([
    apiFetch<Summary>(`/calling/oversight/summary?${summaryQs.toString()}`).then((r) => r.data),
    tab === 'calls' ? apiFetch<CallRow[]>(`/calling/oversight/calls?${listQs.toString()}`) : apiFetch<ShareRow[]>(`/calling/oversight/shares?${listQs.toString()}`),
    apiFetch<UserOpt[]>('/users?role=TELECALLER&pageSize=200').then((r) => r.data).catch(() => [] as UserOpt[]),
    apiFetch<UserOpt[]>('/users?role=MANAGER&pageSize=200').then((r) => r.data).catch(() => [] as UserOpt[]),
  ]);
  const page = Number(sp.page ?? 1);
  const total = Number(list.meta.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / 25));
  const link = (p: Partial<Record<(typeof FILTER_KEYS)[number], string | undefined>>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = { ...sp, page: undefined, ...p };
    for (const k of FILTER_KEYS) if (merged[k]) q.set(k, merged[k] as string);
    const s = q.toString();
    return `/admin/calling-list/oversight${s ? `?${s}` : ''}`;
  };
  const { calls, recordings: rec, shares } = summary;
  const callsHref = link({ tab: undefined, attention: sp.attention === SHARE_ATTENTION ? undefined : sp.attention, delivery: undefined, channel: undefined, kind: undefined });
  const sharesHref = link({ tab: 'shares', attention: sp.attention === SHARE_ATTENTION ? SHARE_ATTENTION : undefined, state: undefined, recording: undefined });
  const maxFailure = Math.max(0, ...calls.topFailureReasons.map((r) => r.count));
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        icon={PhoneCall}
        tone="sky"
        eyebrow="Calling · Caller performance"
        title="Calls & delivery oversight"
        description={`Every call attempt, recording and WhatsApp share across the organisation for ${summary.range.fromDay} → ${summary.range.toDay} (IST; calls by ${summary.dateBasis.calls}, shares by ${summary.dateBasis.shares}). Only provider events can mark a call connected, a recording available or a message delivered.`}
      >
        <StatGrid>
          <StatCard emphasis label="Call attempts (provider-confirmed)" value={calls.providerConfirmed} hint={`of ${calls.initiated} started in KBS · ${calls.failedBeforeProvider} failed before the provider`} icon={PhoneCall} />
          <StatCard label="Connected calls" value={calls.connected} hint={`${pct(calls.connected, calls.providerConfirmed)} of provider-confirmed · talk time ${mins(calls.talkTimeSec)}`} icon={PhoneIncoming} tone="emerald" />
          <StatCard label="Recordings available" value={rec.available} hint={`${pct(rec.available, rec.denominator)} of ${rec.denominator} connected · ${rec.pending} pending · ${rec.failed} failed · ${rec.noneRecorded} none`} icon={Mic} tone="indigo" />
          <StatCard
            label="WhatsApp shares"
            value={shares.total}
            hint={`${shares.deliveryNotReported} hand-off only (delivery not reported) · provider: ${shares.provider.delivered} delivered, ${shares.provider.sent} sent, ${shares.provider.failed} failed, ${shares.provider.awaiting} awaiting`}
            icon={MessageCircle}
            tone="teal"
          />
        </StatGrid>
      </PageHeader>
      <CallerPerformanceNav active="calls" />

      <form className="grid items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)] sm:grid-cols-2 sm:p-5 lg:grid-cols-5" action="/admin/calling-list/oversight">
        {tab === 'shares' ? <input type="hidden" name="tab" value="shares" /> : null}
        <label className={labelCls}>
          From
          <input className={selectClass} type="date" name="from" defaultValue={sp.from ?? summary.range.fromDay} />
        </label>
        <label className={labelCls}>
          To
          <input className={selectClass} type="date" name="to" defaultValue={sp.to ?? summary.range.toDay} />
        </label>
        <label className={labelCls}>
          Manager&apos;s team
          <select className={selectClass} name="managerId" defaultValue={sp.managerId ?? ''}>
            <option value="">Whole organisation</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Telecaller
          <select className={selectClass} name="telecallerId" defaultValue={sp.telecallerId ?? ''}>
            <option value="">Everyone</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit">
            <Filter />
            Apply
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/calling-list/oversight">Reset</Link>
          </Button>
        </div>
      </form>

      <SectionCard
        icon={TriangleAlert}
        tone="amber"
        title="Needs attention"
        description={`No provider confirmation = still requested/ringing/connected ${summary.thresholds.liveWindowMinutes} min after dialling. Recording overdue = connected call still without a recording ${summary.thresholds.recordingOverdueMinutes} min after it ended. These are display thresholds, not business policy.`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {OVERSIGHT_ATTENTION.map((a) => {
            const n = summary.attention[a];
            const active = sp.attention === a;
            const Icon = ATTENTION_ICON[a];
            return (
              <Link
                key={a}
                href={active ? link({ attention: undefined }) : link({ attention: a, tab: a === SHARE_ATTENTION ? 'shares' : 'calls', state: undefined, recording: undefined, delivery: undefined })}
                aria-pressed={active}
                prefetch={false}
                className={cn(
                  'lift group flex min-w-0 flex-col gap-2 rounded-xl border p-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700',
                  active ? 'border-slate-900 bg-slate-900 text-white' : n > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200/80 bg-white',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn('inline-flex size-8 items-center justify-center rounded-lg', active ? 'bg-white/15 text-white' : n > 0 ? 'bg-white text-amber-700 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-500')}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className={cn('text-2xl font-semibold tabular-nums', active ? 'text-white' : n > 0 ? 'text-amber-800' : 'text-slate-400')}>{n}</span>
                </span>
                <span className={cn('text-[12.5px] leading-snug font-medium', active ? 'text-white' : 'text-slate-700')}>
                  {OVERSIGHT_ATTENTION_LABELS[a]}
                </span>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={Activity} tone="sky" title="Provider call states" description={`Source: telephony provider events · denominator ${calls.initiated} attempts started in KBS.`}>
          <ul className="grid gap-1">
            {Object.keys(STATE_LABEL).map((s) => {
              const n = calls.byState[s] ?? 0;
              const on = sp.state === s;
              return (
                <li key={s}>
                  <Link
                    href={on ? link({ state: undefined }) : link({ state: s, tab: 'calls', attention: undefined })}
                    aria-current={on ? 'true' : undefined}
                    prefetch={false}
                    className={cn('grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors', on ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')}
                  >
                    <span className="truncate font-medium">{STATE_LABEL[s]}</span>
                    <Meter value={n} max={calls.initiated} tone={STATE_TONE[s] ?? 'slate'} className={on ? 'bg-white/20' : undefined} />
                    <span className="w-8 text-right tabular-nums">{n}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
        <SectionCard icon={PhoneMissed} tone="rose" title="Top failure reasons" description="As reported by the provider or the adapter.">
          {calls.topFailureReasons.length ? (
            <ul className="grid gap-3 text-sm">
              {calls.topFailureReasons.map((r) => (
                <li key={r.reason} className="grid gap-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0 font-mono text-xs break-all text-slate-700">{r.reason}</span>
                    <span className="font-semibold tabular-nums">{r.count}</span>
                  </div>
                  <Meter value={r.count} max={maxFailure} tone="rose" className="h-1.5" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CircleCheck} title="No failures in this range." className="py-8" />
          )}
        </SectionCard>
      </div>

      <PillNav
        label="Oversight lists"
        active={tab === 'calls' ? callsHref : sharesHref}
        items={[
          { href: callsHref, label: 'Calls', icon: PhoneCall, count: tab === 'calls' ? total : null },
          { href: sharesHref, label: 'WhatsApp shares', icon: MessageCircle, count: tab === 'shares' ? total : null },
        ]}
      />

      {tab === 'calls' ? (
        <SectionCard icon={PhoneCall} tone="sky" title={`${total} call${total === 1 ? '' : 's'}`} description="Newest first · mobiles masked · Play opens a short-lived link and is logged as sensitive access." flush>
          <form className="flex flex-wrap items-end gap-2 px-5 pb-4 sm:px-6" action="/admin/calling-list/oversight">
            {(['from', 'to', 'managerId', 'telecallerId', 'state', 'attention'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
            <label className={cn(labelCls, 'w-44')}>
              Recording
              <select className={selectClass} name="recording" defaultValue={sp.recording ?? ''}>
                <option value="">Any</option>
                <option value="AVAILABLE">Available</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="NONE">None</option>
              </select>
            </label>
            <Button type="submit" variant="outline" className="h-10">
              <Filter />
              Filter
            </Button>
          </form>
          {list.data.length === 0 ? (
            <div className="px-5 pb-5 sm:px-6">
              <EmptyState icon={PhoneCall} title="No calls match these filters." />
            </div>
          ) : (
            <Table responsive>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Telecaller</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Provider state</TableHead>
                  <TableHead>Recording</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data as CallRow[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600">
                      {formatDateTime(c.initiatedAt)}
                    </TableCell>
                    <TableCell data-label="Telecaller">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={c.telecaller.fullName} size="sm" />
                        <div className="min-w-0">
                          <Link className="font-medium" href={`/admin/calling-list/performance/telecaller/${c.telecaller.id}`}>
                            {c.telecaller.fullName}
                          </Link>
                          <div className="text-[11px] text-slate-500">{c.telecaller.employeeCode ?? ''}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-label="Customer">
                      <span className="text-slate-800">{c.customer.fullName}</span>
                      <div className="font-mono text-xs text-slate-500">{c.customer.mobileMasked}</div>
                    </TableCell>
                    <TableCell data-label="Provider state">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={stateVariant(c.providerState)}>{STATE_LABEL[c.providerState] ?? c.providerState}</Badge>
                        {c.durationSec !== null ? <span className="text-xs text-slate-600 tabular-nums">{mins(c.durationSec)}</span> : null}
                      </div>
                      <div className="mt-1 text-[11px] break-all text-slate-500">
                        {c.providerCallId ? `${c.providerKey} · ${c.providerCallId}` : `${c.providerKey} · no provider call id`}
                        {c.failureReason ? ` · ${c.failureReason}` : ''}
                      </div>
                      {c.attention
                        .filter((a) => a === 'NO_PROVIDER_CONFIRMATION' || a === 'FAILED_BEFORE_PROVIDER')
                        .map((a) => (
                          <Badge key={a} variant="warning" className="mt-1">
                            {OVERSIGHT_ATTENTION_LABELS[a]}
                          </Badge>
                        ))}
                    </TableCell>
                    <TableCell data-label="Recording">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={recVariant(c.recording)}>{c.recording}</Badge>
                        {c.canPlay ? <PlayRecordingButton callId={c.id} /> : null}
                      </div>
                      {c.recordingFailureReason ? <div className="mt-1 text-[11px] text-slate-500">{c.recordingFailureReason}</div> : null}
                      {c.attention.includes('RECORDING_OVERDUE') ? (
                        <Badge variant="warning" className="mt-1">
                          {OVERSIGHT_ATTENTION_LABELS.RECORDING_OVERDUE}
                        </Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          icon={MessageCircle}
          tone="teal"
          title={`${total} share${total === 1 ? '' : 's'}`}
          description="Opening WhatsApp on the phone is a hand-off, not proof of delivery. Delivery is shown only when the WhatsApp Business provider reported it."
          flush
        >
          <form className="grid items-end gap-3 px-5 pb-4 sm:grid-cols-4 sm:px-6" action="/admin/calling-list/oversight">
            <input type="hidden" name="tab" value="shares" />
            {(['from', 'to', 'managerId', 'telecallerId', 'attention'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
            <label className={labelCls}>
              What
              <select className={selectClass} name="kind" defaultValue={sp.kind ?? ''}>
                <option value="">Any</option>
                {Object.entries(KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Channel
              <select className={selectClass} name="channel" defaultValue={sp.channel ?? ''}>
                <option value="">Any</option>
                <option value="WHATSAPP_HANDOFF">Hand-off (phone)</option>
                <option value="WHATSAPP_BUSINESS_API">WhatsApp Business provider</option>
              </select>
            </label>
            <label className={labelCls}>
              Provider delivery
              <select className={selectClass} name="delivery" defaultValue={sp.delivery ?? ''}>
                <option value="">Any</option>
                <option value="UNKNOWN">Not reported</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>
            <div>
              <Button type="submit" variant="outline" className="h-10">
                <Filter />
                Filter
              </Button>
            </div>
          </form>
          {list.data.length === 0 ? (
            <div className="px-5 pb-5 sm:px-6">
              <EmptyState icon={MessageCircle} title="No shares match these filters." />
            </div>
          ) : (
            <Table responsive>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Sent by</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data as ShareRow[]).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600">
                      {formatDateTime(s.at)}
                    </TableCell>
                    <TableCell data-label="Sent by">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={s.actor.fullName} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800">{s.actor.fullName}</div>
                          <div className="text-[11px] text-slate-500">{humanize(s.actor.role)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-label="Customer">
                      <span className="text-slate-800">{s.customer?.fullName ?? '—'}</span>
                      <div className="font-mono text-xs text-slate-500">
                        {s.targetMobileMasked}
                        {s.customer?.ref ? ` · ${s.customer.ref}` : ''}
                      </div>
                    </TableCell>
                    <TableCell data-label="Material">
                      <span className="font-medium text-slate-800">{KIND_LABEL[s.kind] ?? s.kind}</span>
                      <div className="text-[11px] text-slate-500">
                        {s.card?.name ?? ''}
                        {s.assetVersionRef ? ` · ${s.assetVersionRef}` : ''}
                      </div>
                    </TableCell>
                    <TableCell data-label="Delivery">
                      <Badge variant={deliveryVariant(s.deliveryLabel)} className="whitespace-normal">
                        {s.deliveryLabel}
                      </Badge>
                      <div className="mt-1 text-[11px] text-slate-500">{s.channel === 'WHATSAPP_HANDOFF' ? 'Hand-off (phone)' : 'WhatsApp Business provider'}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={link({ page: String(page - 1) })}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-slate-500 tabular-nums">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Button asChild size="sm" variant="outline">
              <Link href={link({ page: String(page + 1) })}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
