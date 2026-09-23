import { formatDateTime } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WfhPanel } from '@/components/network-policy';
import { apiFetch } from '@/lib/api';
import type { WfhRow } from '@/lib/wfh';
import { STATUS_LABEL, statusTone, type TrainingDetail } from '@/lib/training-types';

import { ReactivateButton } from './reactivate-button';

/** F-204/F-205: Telecaller training detail with Manager reactivation. */
export default async function TelecallerTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [d, wfh] = await Promise.all([
    apiFetch<TrainingDetail>(`/telecallers/${id}/training`).then((r) => r.data),
    apiFetch<WfhRow[]>('/access-policy/wfh').then((r) => r.data),
  ]);
  return (
    <div className="grid max-w-4xl gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{d.telecaller.fullName}</h1>
          <p className="text-muted-foreground font-mono text-sm">{d.telecaller.employeeCode}</p>
        </div>
        <Badge variant={statusTone(d.status)}>{STATUS_LABEL[d.status] ?? d.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Training window</CardTitle>
          <CardDescription>
            {d.firstLoginAt
              ? `First login ${formatDateTime(d.firstLoginAt)}`
              : 'Not logged in yet — the 72-hour window starts at the first login.'}
            {d.deadlineAt ? ` · deadline ${formatDateTime(d.deadlineAt)}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {d.status === 'EXPIRED_DEACTIVATED' ? (
            <p className="text-sm">
              The window ended without all modules passed; the account is deactivated. Reactivating
              resumes at Module {d.modules.find((m) => m.status !== 'PASSED')?.sequence ?? 3} and
              keeps earlier passes.
            </p>
          ) : null}
          {d.status === 'REACTIVATED_IN_PROGRESS' && !d.deadlineAt ? (
            <p className="text-warning text-sm">
              Reactivated, but `training.reactivationWindowHours` is not configured — the Telecaller
              stays gated until the Admin sets it.
            </p>
          ) : null}
          {d.canReactivate ? (
            <ReactivateButton
              telecallerId={d.telecaller.id}
              windowHours={d.reactivationWindowHours}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work from home</CardTitle>
          <CardDescription>
            Outside an office network this Telecaller can call only with an active exception (REQ-09
            §9.1). Grants and revocations are audited and notify the Telecaller.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WfhPanel telecallerId={d.telecaller.id} rows={wfh} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Best score</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Video</TableHead>
                <TableHead>Passed at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.modules.map((m) => (
                <TableRow key={m.sequence}>
                  <TableCell>
                    {m.sequence}. {m.title}
                    <div className="text-muted-foreground text-xs">
                      pass mark {m.passThresholdPct}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        m.status === 'PASSED'
                          ? 'success'
                          : m.status === 'LOCKED'
                            ? 'unknown'
                            : 'info'
                      }
                    >
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.bestScorePct ?? '—'}
                    {m.bestScorePct !== null ? '%' : ''}
                  </TableCell>
                  <TableCell>
                    {m.attemptCount}
                    {m.attempts.length ? (
                      <div className="text-muted-foreground text-xs">
                        {m.attempts
                          .map((a) => (a.scorePct === null ? 'open' : `${a.scorePct}%`))
                          .join(', ')}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.videoCompletedAt ? 'completed' : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.passedAt ? formatDateTime(m.passedAt) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {d.reactivations.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Reactivations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {d.reactivations.map((r) => (
              <div key={r.id} className="rounded-md border p-3">
                <div>
                  {formatDateTime(r.at)} by {r.byManager.fullName} — resumed at Module{' '}
                  {r.resumedAtModuleSequence}
                </div>
                <div className="text-muted-foreground text-xs">
                  Original deadline{' '}
                  {r.originalDeadlineAt ? formatDateTime(r.originalDeadlineAt) : '—'} · new deadline{' '}
                  {r.newDeadlineAt ? formatDateTime(r.newDeadlineAt) : 'not configured'} · reason:{' '}
                  {r.reason}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
