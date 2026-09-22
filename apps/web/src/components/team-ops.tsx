import { formatDateTime, OUTCOME_LABELS } from '@kbs/shared';

import { PlayRecordingButton } from '@/components/play-recording-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface OverviewRow {
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

function rangeParams(sp: { from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (sp.from) q.set('from', new Date(sp.from).toISOString());
  if (sp.to) q.set('to', new Date(sp.to).toISOString());
  return q.toString();
}

/** F-313 §1: team overview — evidence counts with denominators, no ranking. */
export async function TeamOverview({ base, sp }: { base: string; sp: { from?: string; to?: string } }) {
  const ov = await apiFetch<{ range: { from: string; to: string }; telecallers: OverviewRow[] }>(`/calling/team/overview?${rangeParams(sp)}`);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team activity</CardTitle>
        <CardDescription>
          {formatDateTime(ov.data.range.from)} → {formatDateTime(ov.data.range.to)} · attempts = call rows; connected = provider-confirmed only.{' '}
          <RangeForm base={base} sp={sp} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Telecaller</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Follow-ups due</TableHead>
              <TableHead>Attempts / connected</TableHead>
              <TableHead>Talk time</TableHead>
              <TableHead>Outcomes</TableHead>
              <TableHead>Shares</TableHead>
              <TableHead>Interests</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ov.data.telecallers.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <a className="underline" href={`${base}/telecaller/${t.id}?${rangeParams(sp)}`}>
                    {t.fullName}
                  </a>
                  {t.employeeCode ? <span className="text-muted-foreground text-xs"> · {t.employeeCode}</span> : null}
                </TableCell>
                <TableCell className="space-x-1">
                  <Badge variant={t.status === 'ACTIVE' ? 'success' : 'unknown'}>{t.status}</Badge>
                  <Badge variant={t.training === 'PASSED' ? 'success' : 'warning'}>{t.training === 'PASSED' ? 'trained' : t.training.toLowerCase().replace(/_/g, ' ')}</Badge>
                  {t.wfhActive ? <Badge variant="info">WFH</Badge> : null}
                </TableCell>
                <TableCell>{t.queueSize}</TableCell>
                <TableCell>{t.followUpsDue ? <Badge variant="destructive">{t.followUpsDue}</Badge> : 0}</TableCell>
                <TableCell>
                  {t.attempts} / {t.connected}
                </TableCell>
                <TableCell className="text-xs">{Math.round(t.talkTimeSec / 60)} min</TableCell>
                <TableCell className="text-xs">
                  {Object.entries(t.outcomes)
                    .map(([k, n]) => `${OUTCOME_LABELS[k as keyof typeof OUTCOME_LABELS] ?? k}: ${n}`)
                    .join(' · ') || '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {Object.entries(t.shares)
                    .map(([k, n]) => `${k.toLowerCase().replace(/_/g, ' ')} ${n}`)
                    .join(' · ') || '—'}
                </TableCell>
                <TableCell>{t.interests}</TableCell>
              </TableRow>
            ))}
            {ov.data.telecallers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-center">
                  No Telecallers.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RangeForm({ base, sp }: { base: string; sp: { from?: string; to?: string } }) {
  return (
    <form action={base} method="get" className="mt-2 inline-flex flex-wrap items-center gap-2 text-xs">
      <label>
        From <input type="date" name="from" defaultValue={sp.from?.slice(0, 10)} className="border-input bg-background h-7 rounded-md border px-1" />
      </label>
      <label>
        To <input type="date" name="to" defaultValue={sp.to?.slice(0, 10)} className="border-input bg-background h-7 rounded-md border px-1" />
      </label>
      <button type="submit" className="border-input h-7 rounded-md border px-2">
        Apply
      </button>
    </form>
  );
}

interface Activity {
  telecaller: { id: string; fullName: string; employeeCode: string | null; status: string };
  range: { from: string; to: string };
  queueSize: number;
  attempts: { id: string; at: string; customer: { id: string; fullName: string; mobileMasked: string | null }; providerState: string; durationSec: number | null; failureReason: string | null; recording: string; canPlay: boolean }[];
  outcomes: { id: string; at: string; customer: { id: string; fullName: string }; outcome: string; remarks: string | null; followUpAt: string | null; card: string | null; doNotContact: boolean }[];
  shares: { id: string; at: string; customer: { id: string; fullName: string } | null; kind: string; card: string | null; handoffResult: string; deliveryStatus: string; targetMobileMasked: string }[];
  remarks: { id: string; at: string; callingRecordId: string; text: string; editedAt: string | null }[];
  allocations: { id: string; at: string; customer: { id: string; fullName: string }; direction: 'IN' | 'OUT'; reason: string }[];
  followUps: { id: string; fullName: string; mobileMasked: string | null; dueAt: string | null; overdue: boolean; interactionStatus: string }[];
}

/** F-313 §2: Telecaller drill-down with recording playback (audited) — Manager team / Admin. */
export async function TelecallerActivity({ id, base, sp }: { id: string; base: string; sp: { from?: string; to?: string } }) {
  const a = (await apiFetch<Activity>(`/calling/team/telecallers/${id}/activity?${rangeParams(sp)}`)).data;
  const section = (title: string, desc: string, body: React.ReactNode) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
  const empty = (n: number, cols: number) =>
    n === 0 ? (
      <TableRow>
        <TableCell colSpan={cols} className="text-muted-foreground text-center">
          Nothing in this range.
        </TableCell>
      </TableRow>
    ) : null;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{a.telecaller.fullName}</h1>
        <Badge variant={a.telecaller.status === 'ACTIVE' ? 'success' : 'unknown'}>{a.telecaller.status}</Badge>
        <span className="text-muted-foreground text-sm">
          {a.telecaller.employeeCode} · queue {a.queueSize} · {formatDateTime(a.range.from)} → {formatDateTime(a.range.to)}
        </span>
        <RangeForm base={`${base}/telecaller/${id}`} sp={sp} />
      </div>
      {section(
        'Follow-ups',
        'Open follow-ups on this queue (all time).',
        <Table>
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
                <TableCell>
                  {f.fullName} <span className="text-muted-foreground font-mono text-xs">{f.mobileMasked}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {f.dueAt ? formatDateTime(f.dueAt) : '—'} {f.overdue ? <Badge variant="destructive">overdue</Badge> : null}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{f.interactionStatus}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {empty(a.followUps.length, 3)}
          </TableBody>
        </Table>,
      )}
      {section(
        'Calls',
        `${a.attempts.length} attempts · ${a.attempts.filter((x) => x.providerState === 'ENDED').length} connected (provider-confirmed). Recording chip reflects the provider's recording row; playback is logged.`,
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Recording</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.attempts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs">{formatDateTime(c.at)}</TableCell>
                <TableCell>
                  {c.customer.fullName} <span className="text-muted-foreground font-mono text-xs">{c.customer.mobileMasked}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={c.providerState === 'ENDED' ? 'success' : c.providerState === 'FAILED' || c.providerState === 'NO_ANSWER' ? 'destructive' : 'info'}>{c.providerState}</Badge>
                  {c.failureReason ? <span className="text-muted-foreground ml-1 text-xs">{c.failureReason}</span> : null}
                </TableCell>
                <TableCell className="text-xs">{c.durationSec !== null ? `${c.durationSec}s` : '—'}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant={c.recording === 'Recording available' ? 'success' : c.recording === 'Recording unavailable' ? 'destructive' : 'unknown'}>{c.recording}</Badge> {c.canPlay ? <PlayRecordingButton callId={c.id} /> : null}
                </TableCell>
              </TableRow>
            ))}
            {empty(a.attempts.length, 5)}
          </TableBody>
        </Table>,
      )}
      {section(
        'Outcomes',
        'Operational outcomes as recorded by the Telecaller — never a bank stage.',
        <Table>
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
                <TableCell className="text-xs">{formatDateTime(o.at)}</TableCell>
                <TableCell>{o.customer.fullName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{OUTCOME_LABELS[o.outcome as keyof typeof OUTCOME_LABELS] ?? o.outcome}</Badge>
                  {o.card ? <span className="ml-1 text-xs">{o.card}</span> : null}
                  {o.doNotContact ? <Badge variant="destructive">DNC</Badge> : null}
                </TableCell>
                <TableCell className="text-xs">
                  {o.remarks ?? '—'}
                  {o.followUpAt ? ` · follow-up ${formatDateTime(o.followUpAt)}` : ''}
                </TableCell>
              </TableRow>
            ))}
            {empty(a.outcomes.length, 4)}
          </TableBody>
        </Table>,
      )}
      {section(
        'Materials shared',
        '"Share sheet opened" is a hand-off, not a delivery confirmation.',
        <Table>
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
                <TableCell className="text-xs">{formatDateTime(s.at)}</TableCell>
                <TableCell>
                  {s.customer?.fullName ?? '—'} <span className="text-muted-foreground font-mono text-xs">{s.targetMobileMasked}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {s.kind.toLowerCase().replace(/_/g, ' ')}
                  {s.card ? ` · ${s.card}` : ''}
                </TableCell>
                <TableCell className="text-xs">{s.deliveryStatus === 'DELIVERED' ? 'Delivered' : s.deliveryStatus === 'SENT' ? 'Sent' : s.deliveryStatus === 'FAILED' ? 'Delivery failed' : s.handoffResult === 'OPENED' ? 'Share sheet opened' : 'Could not open share sheet'}</TableCell>
              </TableRow>
            ))}
            {empty(a.shares.length, 4)}
          </TableBody>
        </Table>,
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {section(
          'Remarks',
          'Operational remarks by this Telecaller.',
          <ul className="grid gap-1 text-sm">
            {a.remarks.map((r) => (
              <li key={r.id} className="border-b py-1">
                <span className="text-muted-foreground text-xs">{formatDateTime(r.at)}</span> {r.text}
                {r.editedAt ? <span className="text-muted-foreground text-xs"> (edited)</span> : null}
              </li>
            ))}
            {a.remarks.length === 0 ? <li className="text-muted-foreground">Nothing in this range.</li> : null}
          </ul>,
        )}
        {section(
          'Allocation history',
          'Records moved in or out of this queue.',
          <ul className="grid gap-1 text-sm">
            {a.allocations.map((e) => (
              <li key={e.id} className="border-b py-1">
                <span className="text-muted-foreground text-xs">{formatDateTime(e.at)}</span> <Badge variant={e.direction === 'IN' ? 'success' : 'unknown'}>{e.direction}</Badge> {e.customer.fullName} · {e.reason}
              </li>
            ))}
            {a.allocations.length === 0 ? <li className="text-muted-foreground">Nothing in this range.</li> : null}
          </ul>,
        )}
      </div>
    </div>
  );
}
