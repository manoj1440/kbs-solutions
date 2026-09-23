import { formatDateTime, OVERSIGHT_ATTENTION, OVERSIGHT_ATTENTION_LABELS, type OversightAttention } from '@kbs/shared';
import Link from 'next/link';

import { PlayRecordingButton } from '@/components/play-recording-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

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

const sel = 'border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm';
const KIND_LABEL: Record<string, string> = { BENEFIT_PDF: 'Benefit PDF', OFFICE_ID: 'Office ID', APPLICATION_LINK: 'Application link' };
const STATE_LABEL: Record<string, string> = { REQUESTED: 'Requested', RINGING: 'Ringing', CONNECTED: 'Connected', ENDED: 'Ended (connected)', FAILED: 'Failed', NO_ANSWER: 'No answer', UNKNOWN: 'Unknown' };
const SHARE_ATTENTION: OversightAttention = 'SHARE_FAILED';
const FILTER_KEYS = ['from', 'to', 'managerId', 'telecallerId', 'state', 'recording', 'attention', 'delivery', 'channel', 'kind', 'tab', 'page'] as const;

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
const mins = (sec: number) => `${Math.floor(sec / 60)}m ${sec % 60}s`;
const stateVariant = (s: string) => (s === 'ENDED' ? 'success' : s === 'FAILED' ? 'destructive' : s === 'NO_ANSWER' ? 'warning' : 'unknown');
const recVariant = (r: string) => (r === 'Recording available' ? 'success' : r === 'Recording unavailable' ? 'destructive' : r === 'Recording pending' ? 'warning' : 'unknown');
const deliveryVariant = (l: string) => (l.startsWith('Delivered') || l.startsWith('Sent') ? 'success' : l.includes('failed') || l.startsWith('Could not') ? 'destructive' : 'unknown');

function Tile({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="bg-card min-w-0 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  );
}

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
  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Calls & delivery oversight</h1>
        <p className="text-muted-foreground text-sm">
          Every call attempt, recording and WhatsApp share across the organisation for {summary.range.fromDay} → {summary.range.toDay} (IST; calls by {summary.dateBasis.calls}, shares by {summary.dateBasis.shares}). Only provider events can mark a call connected, a recording available or a message delivered.
        </p>
      </div>

      <form className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-5" action="/admin/calling-list/oversight">
        {tab === 'shares' ? <input type="hidden" name="tab" value="shares" /> : null}
        <label className="grid gap-1 text-xs">
          From
          <input className={sel} type="date" name="from" defaultValue={sp.from ?? summary.range.fromDay} />
        </label>
        <label className="grid gap-1 text-xs">
          To
          <input className={sel} type="date" name="to" defaultValue={sp.to ?? summary.range.toDay} />
        </label>
        <label className="grid gap-1 text-xs">
          Manager&apos;s team
          <select className={sel} name="managerId" defaultValue={sp.managerId ?? ''}>
            <option value="">Whole organisation</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Telecaller
          <select className={sel} name="telecallerId" defaultValue={sp.telecallerId ?? ''}>
            <option value="">Everyone</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/admin/calling-list/oversight">Reset</Link>
          </Button>
        </div>
      </form>

      <section aria-label="Needs attention" className="grid gap-2">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <div className="flex flex-wrap gap-2">
          {OVERSIGHT_ATTENTION.map((a) => {
            const n = summary.attention[a];
            const active = sp.attention === a;
            return (
              <Button key={a} asChild size="sm" variant={active ? 'default' : n > 0 ? 'outline' : 'ghost'}>
                <Link href={active ? link({ attention: undefined }) : link({ attention: a, tab: a === SHARE_ATTENTION ? 'shares' : 'calls', state: undefined, recording: undefined, delivery: undefined })} aria-pressed={active}>
                  {OVERSIGHT_ATTENTION_LABELS[a]} <span className="tabular-nums">({n})</span>
                </Link>
              </Button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          No provider confirmation = still requested/ringing/connected {summary.thresholds.liveWindowMinutes} min after dialling. Recording overdue = connected call still without a recording{' '}
          {summary.thresholds.recordingOverdueMinutes} min after it ended. These are display thresholds, not business policy.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Call attempts (provider-confirmed)" value={calls.providerConfirmed} note={`of ${calls.initiated} started in KBS · ${calls.failedBeforeProvider} failed before the provider`} />
        <Tile label="Connected calls" value={calls.connected} note={`${pct(calls.connected, calls.providerConfirmed)} of provider-confirmed · talk time ${mins(calls.talkTimeSec)}`} />
        <Tile label="Recordings available" value={rec.available} note={`${pct(rec.available, rec.denominator)} of ${rec.denominator} connected · ${rec.pending} pending · ${rec.failed} failed · ${rec.noneRecorded} none`} />
        <Tile
          label="WhatsApp shares"
          value={shares.total}
          note={`${shares.deliveryNotReported} hand-off only (delivery not reported) · provider: ${shares.provider.delivered} delivered, ${shares.provider.sent} sent, ${shares.provider.failed} failed, ${shares.provider.awaiting} awaiting`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider call states</CardTitle>
            <CardDescription>Source: telephony provider events · denominator {calls.initiated} attempts started in KBS.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.keys(STATE_LABEL).map((s) => (
              <Button key={s} asChild size="sm" variant={sp.state === s ? 'default' : 'outline'}>
                <Link href={sp.state === s ? link({ state: undefined }) : link({ state: s, tab: 'calls', attention: undefined })}>
                  {STATE_LABEL[s]} <span className="tabular-nums">({calls.byState[s] ?? 0})</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top failure reasons</CardTitle>
            <CardDescription>As reported by the provider or the adapter.</CardDescription>
          </CardHeader>
          <CardContent>
            {calls.topFailureReasons.length ? (
              <ul className="grid gap-1 text-sm">
                {calls.topFailureReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-2">
                    <span className="min-w-0 font-mono text-xs break-all">{r.reason}</span>
                    <span className="tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No failures in this range.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button asChild size="sm" variant={tab === 'calls' ? 'default' : 'outline'}>
          <Link href={link({ tab: undefined, attention: sp.attention === SHARE_ATTENTION ? undefined : sp.attention, delivery: undefined, channel: undefined, kind: undefined })}>Calls</Link>
        </Button>
        <Button asChild size="sm" variant={tab === 'shares' ? 'default' : 'outline'}>
          <Link href={link({ tab: 'shares', attention: sp.attention === SHARE_ATTENTION ? SHARE_ATTENTION : undefined, state: undefined, recording: undefined })}>WhatsApp shares</Link>
        </Button>
      </div>

      {tab === 'calls' ? (
        <Card>
          <CardHeader className="gap-2">
            <CardTitle>
              {total} call{total === 1 ? '' : 's'}
            </CardTitle>
            <CardDescription>Newest first · mobiles masked · Play opens a short-lived link and is logged as sensitive access.</CardDescription>
            <form className="flex flex-wrap items-end gap-2" action="/admin/calling-list/oversight">
              {(['from', 'to', 'managerId', 'telecallerId', 'state', 'attention'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
              <label className="grid gap-1 text-xs">
                Recording
                <select className={sel} name="recording" defaultValue={sp.recording ?? ''}>
                  <option value="">Any</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="NONE">None</option>
                </select>
              </label>
              <Button type="submit" size="sm" variant="outline">
                Filter
              </Button>
            </form>
          </CardHeader>
          <CardContent>
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
                    <TableCell data-label="When" className="text-xs">
                      {formatDateTime(c.initiatedAt)}
                    </TableCell>
                    <TableCell data-label="Telecaller">
                      <Link className="underline-offset-2 hover:underline" href={`/admin/calling-list/distribution/telecaller/${c.telecaller.id}`}>
                        {c.telecaller.fullName}
                      </Link>
                      <div className="text-muted-foreground text-xs">{c.telecaller.employeeCode ?? ''}</div>
                    </TableCell>
                    <TableCell data-label="Customer">
                      {c.customer.fullName}
                      <div className="text-muted-foreground font-mono text-xs">{c.customer.mobileMasked}</div>
                    </TableCell>
                    <TableCell data-label="Provider state">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={stateVariant(c.providerState)}>{STATE_LABEL[c.providerState] ?? c.providerState}</Badge>
                        {c.durationSec !== null ? <span className="text-xs tabular-nums">{mins(c.durationSec)}</span> : null}
                      </div>
                      <div className="text-muted-foreground text-xs break-all">
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
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={recVariant(c.recording)}>{c.recording}</Badge>
                        {c.canPlay ? <PlayRecordingButton callId={c.id} /> : null}
                      </div>
                      {c.recordingFailureReason ? <div className="text-muted-foreground text-xs">{c.recordingFailureReason}</div> : null}
                      {c.attention.includes('RECORDING_OVERDUE') ? (
                        <Badge variant="warning" className="mt-1">
                          {OVERSIGHT_ATTENTION_LABELS.RECORDING_OVERDUE}
                        </Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {list.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No calls match these filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="gap-2">
            <CardTitle>
              {total} share{total === 1 ? '' : 's'}
            </CardTitle>
            <CardDescription>Opening WhatsApp on the phone is a hand-off, not proof of delivery. Delivery is shown only when the WhatsApp Business provider reported it.</CardDescription>
            <form className="grid items-end gap-2 sm:grid-cols-4" action="/admin/calling-list/oversight">
              <input type="hidden" name="tab" value="shares" />
              {(['from', 'to', 'managerId', 'telecallerId', 'attention'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
              <label className="grid gap-1 text-xs">
                What
                <select className={sel} name="kind" defaultValue={sp.kind ?? ''}>
                  <option value="">Any</option>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs">
                Channel
                <select className={sel} name="channel" defaultValue={sp.channel ?? ''}>
                  <option value="">Any</option>
                  <option value="WHATSAPP_HANDOFF">Hand-off (phone)</option>
                  <option value="WHATSAPP_BUSINESS_API">WhatsApp Business provider</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs">
                Provider delivery
                <select className={sel} name="delivery" defaultValue={sp.delivery ?? ''}>
                  <option value="">Any</option>
                  <option value="UNKNOWN">Not reported</option>
                  <option value="SENT">Sent</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                </select>
              </label>
              <Button type="submit" size="sm" variant="outline">
                Filter
              </Button>
            </form>
          </CardHeader>
          <CardContent>
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
                    <TableCell data-label="When" className="text-xs">
                      {formatDateTime(s.at)}
                    </TableCell>
                    <TableCell data-label="Sent by">
                      {s.actor.fullName}
                      <div className="text-muted-foreground text-xs">{s.actor.role.toLowerCase()}</div>
                    </TableCell>
                    <TableCell data-label="Customer">
                      {s.customer?.fullName ?? '—'}
                      <div className="text-muted-foreground font-mono text-xs">
                        {s.targetMobileMasked}
                        {s.customer?.ref ? ` · ${s.customer.ref}` : ''}
                      </div>
                    </TableCell>
                    <TableCell data-label="Material">
                      {KIND_LABEL[s.kind] ?? s.kind}
                      <div className="text-muted-foreground text-xs">
                        {s.card?.name ?? ''}
                        {s.assetVersionRef ? ` · ${s.assetVersionRef}` : ''}
                      </div>
                    </TableCell>
                    <TableCell data-label="Delivery">
                      <Badge variant={deliveryVariant(s.deliveryLabel)}>{s.deliveryLabel}</Badge>
                      <div className="text-muted-foreground text-xs">{s.channel === 'WHATSAPP_HANDOFF' ? 'Hand-off (phone)' : 'WhatsApp Business provider'}</div>
                    </TableCell>
                  </TableRow>
                ))}
                {list.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No shares match these filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
          <span className="text-muted-foreground">
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
