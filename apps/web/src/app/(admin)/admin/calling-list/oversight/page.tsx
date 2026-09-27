import { formatDateTime, OVERSIGHT_ATTENTION, OVERSIGHT_ATTENTION_LABELS, type OversightAttention } from '@kbs/shared';
import { AlarmClock, ChevronRight, CircleCheck, Filter, type LucideIcon, MessageCircle, MessageSquareX, MicOff, PhoneCall, PhoneMissed, PhoneOff } from 'lucide-react';
import Link from 'next/link';

import { PlayRecordingButton } from '@/components/play-recording-button';
import { CallerPerformanceNav } from '@/components/caller-performance-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, Meter, MiniStat, PillNav, selectClass } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Calls & delivery · KBS Solutions' };

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
 * F-808: one-screen layout — tiles, one panel, the table scrolls inside it.
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
  const attentionTotal = OVERSIGHT_ATTENTION.reduce((n, a) => n + summary.attention[a], 0);
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Calls &amp; delivery oversight</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <MiniStat label="Provider-confirmed calls" value={calls.providerConfirmed} hint={`${calls.initiated} started in KBS · ${calls.failedBeforeProvider} failed before provider`} tone="sky" />
        <MiniStat label="Connected" value={calls.connected} hint={`${pct(calls.connected, calls.providerConfirmed)} of confirmed · ${mins(calls.talkTimeSec)} talk`} tone="emerald" />
        <MiniStat label="Recordings available" value={rec.available} hint={`${pct(rec.available, rec.denominator)} of ${rec.denominator} connected · ${rec.pending} pending · ${rec.failed} failed`} tone="indigo" />
        <MiniStat label="WhatsApp shares" value={shares.total} hint={`${shares.provider.delivered} delivered · ${shares.provider.failed} failed · ${shares.deliveryNotReported} not reported`} tone="teal" />
        <MiniStat label="Needs attention" value={attentionTotal} hint={`thresholds ${summary.thresholds.liveWindowMinutes} / ${summary.thresholds.recordingOverdueMinutes} min`} tone={attentionTotal ? 'amber' : 'slate'} />
      </div>
      <section aria-label="Calls and delivery" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="grid gap-2 border-b border-slate-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CallerPerformanceNav active="calls" />
            <span className="text-[11px] text-slate-500">
              {summary.range.fromDay} → {summary.range.toDay} IST · calls by {summary.dateBasis.calls} · shares by {summary.dateBasis.shares}
            </span>
          </div>
          <form className="flex flex-wrap items-end gap-2" action="/admin/calling-list/oversight">
            {tab === 'shares' ? <input type="hidden" name="tab" value="shares" /> : null}
            {(['attention', 'state'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
            <input aria-label="From" className={cn(selectClass, 'h-9 w-36')} type="date" name="from" defaultValue={sp.from ?? summary.range.fromDay} />
            <input aria-label="To" className={cn(selectClass, 'h-9 w-36')} type="date" name="to" defaultValue={sp.to ?? summary.range.toDay} />
            <select aria-label="Manager's team" className={cn(selectClass, 'h-9 w-auto min-w-36')} name="managerId" defaultValue={sp.managerId ?? ''}>
              <option value="">All teams</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <select aria-label="Telecaller" className={cn(selectClass, 'h-9 w-auto min-w-36')} name="telecallerId" defaultValue={sp.telecallerId ?? ''}>
              <option value="">All telecallers</option>
              {telecallers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
            {tab === 'calls' ? (
              <select aria-label="Recording" className={cn(selectClass, 'h-9 w-auto')} name="recording" defaultValue={sp.recording ?? ''}>
                <option value="">Any recording</option>
                <option value="AVAILABLE">Recording available</option>
                <option value="PENDING">Recording pending</option>
                <option value="FAILED">Recording failed</option>
                <option value="NONE">No recording</option>
              </select>
            ) : (
              <>
                <select aria-label="Material" className={cn(selectClass, 'h-9 w-auto')} name="kind" defaultValue={sp.kind ?? ''}>
                  <option value="">Any material</option>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select aria-label="Channel" className={cn(selectClass, 'h-9 w-auto')} name="channel" defaultValue={sp.channel ?? ''}>
                  <option value="">Any channel</option>
                  <option value="WHATSAPP_HANDOFF">Hand-off (phone)</option>
                  <option value="WHATSAPP_BUSINESS_API">WhatsApp Business provider</option>
                </select>
                <select aria-label="Provider delivery" className={cn(selectClass, 'h-9 w-auto')} name="delivery" defaultValue={sp.delivery ?? ''}>
                  <option value="">Any delivery</option>
                  <option value="UNKNOWN">Not reported</option>
                  <option value="SENT">Sent</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                </select>
              </>
            )}
            <Button type="submit" size="sm" className="h-9">
              <Filter />
              Apply
            </Button>
            <Button asChild size="sm" variant="ghost" className="h-9">
              <Link href="/admin/calling-list/oversight">Reset</Link>
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PillNav
              label="Oversight lists"
              className="-my-1 px-0 pb-0"
              active={tab === 'calls' ? callsHref : sharesHref}
              items={[
                { href: callsHref, label: 'Calls', icon: PhoneCall, count: tab === 'calls' ? total : null },
                { href: sharesHref, label: 'WhatsApp shares', icon: MessageCircle, count: tab === 'shares' ? total : null },
              ]}
            />
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden="true" />
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
                    'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700',
                    active ? 'border-slate-900 bg-slate-900 text-white' : n > 0 ? 'border-amber-200 bg-amber-50/60 text-amber-800' : 'border-slate-200/80 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {OVERSIGHT_ATTENTION_LABELS[a]}
                  <span className={cn('font-semibold tabular-nums', active ? 'text-white' : n > 0 ? 'text-amber-800' : 'text-slate-400')}>{n}</span>
                </Link>
              );
            })}
          </div>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-medium text-slate-500 select-none hover:text-slate-800 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
              Call states &amp; top failure reasons
            </summary>
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              <ul className="grid content-start gap-0.5">
                {Object.keys(STATE_LABEL).map((s) => {
                  const n = calls.byState[s] ?? 0;
                  const on = sp.state === s;
                  return (
                    <li key={s}>
                      <Link
                        href={on ? link({ state: undefined }) : link({ state: s, tab: 'calls', attention: undefined })}
                        aria-current={on ? 'true' : undefined}
                        prefetch={false}
                        className={cn('grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors', on ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')}
                      >
                        <span className="truncate font-medium">{STATE_LABEL[s]}</span>
                        <Meter value={n} max={calls.initiated} tone={STATE_TONE[s] ?? 'slate'} className={on ? 'bg-white/20' : undefined} />
                        <span className="w-8 text-right tabular-nums">{n}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {calls.topFailureReasons.length ? (
                <ul className="grid content-start gap-2 text-sm">
                  {calls.topFailureReasons.map((r) => (
                    <li key={r.reason} className="grid gap-1">
                      <div className="flex justify-between gap-2">
                        <span className="min-w-0 font-mono text-xs break-all text-slate-700">{r.reason}</span>
                        <span className="font-semibold tabular-nums">{r.count}</span>
                      </div>
                      <Meter value={r.count} max={maxFailure} tone="rose" className="h-1.5" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <CircleCheck className="size-3.5 text-emerald-600" aria-hidden="true" />
                  No failures in this range.
                </p>
              )}
            </div>
          </details>
        </div>
        <div className="min-h-0 flex-1">
          {list.data.length === 0 ? (
            <EmptyState icon={tab === 'calls' ? PhoneCall : MessageCircle} className="m-3" title={tab === 'calls' ? 'No calls match these filters.' : 'No shares match these filters.'} />
          ) : tab === 'calls' ? (
            <Table responsive containerClassName="lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-white">
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
          ) : (
            <Table responsive containerClassName="lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-white">
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
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-500 tabular-nums">
            {total} {tab === 'calls' ? `call${total === 1 ? '' : 's'}` : `share${total === 1 ? '' : 's'}`} · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page - 1) })}>Previous</Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page + 1) })}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
