import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

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
import { apiFetch } from '@/lib/api';

import { LegalHoldForm, RunRetention } from './actions';

interface CategoryPlan {
  category: string;
  label: string;
  configKey: string;
  action: 'PURGE_FILE' | 'RESTRICT_RECORD';
  days: number | null;
  configured: boolean;
  cutoff: string | null;
  olderThanCutoff: number | null;
  onHold: number | null;
  protected: number | null;
  eligible: number | null;
  onHoldTotal: number;
  alreadyDone: number;
  runnable: boolean;
  blockedReason: string | null;
}
interface Plan {
  executionEnabled: boolean;
  scheduleEnabled: boolean;
  neverRemoved: string[];
  categories: CategoryPlan[];
}
interface Hold {
  subject: string;
  id: string;
  label: string;
  reason: string | null;
  createdAt: string;
  restricted?: boolean;
}

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-IN'));

/** F-904 Admin: retention dry run, fail-closed execution and legal holds (REQ-21 §21.5). */
export default async function RetentionPage() {
  const [{ data: plan }, { data: holds }] = await Promise.all([
    apiFetch<Plan>('/retention/plan'),
    apiFetch<{ files: Hold[]; records: Hold[] }>('/retention/legal-holds'),
  ]);
  const allHolds = [...holds.files, ...holds.records];
  const unset = plan.categories.filter((c) => !c.configured);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Data retention & legal hold</h1>
        <p className="text-muted-foreground text-sm">
          Files past their retention period are purged from storage (the record of the file stays).
          Calling records are restricted — personal details removed and hidden from queues — never
          deleted.
        </p>
      </div>

      {unset.length || !plan.executionEnabled ? (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="warning">Blocked</Badge> Retention is not running
            </CardTitle>
            <CardDescription>
              KBS has not approved retention durations yet (REQ-21 §21.5 OPEN). Nothing is purged or
              restricted until each duration is set and{' '}
              <span className="font-mono">retention.executionEnabled</span> is turned on in{' '}
              <Link className="underline" href="/admin/config">
                Configuration
              </Link>
              .{unset.length ? ` Missing: ${unset.map((c) => c.configKey).join(', ')}.` : ''}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Dry run</CardTitle>
          <CardDescription>
            Nightly run (02:00 IST):{' '}
            <Badge variant={plan.scheduleEnabled && plan.executionEnabled ? 'success' : 'unknown'}>
              {plan.scheduleEnabled && plan.executionEnabled ? 'on' : 'off'}
            </Badge>{' '}
            — needs <span className="font-mono">retention.scheduleEnabled</span> and{' '}
            <span className="font-mono">retention.executionEnabled</span>; only categories with a set duration run.
          </CardDescription>
          <CardDescription>
            Counts are computed live and change nothing. Protected items are kept for a legitimate
            obligation (payout proofs, live cheques and ID cards, MIS files still being processed,
            quarantined uploads).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead className="text-right">Past cutoff</TableHead>
                  <TableHead className="text-right">Legal hold</TableHead>
                  <TableHead className="text-right">Protected</TableHead>
                  <TableHead className="text-right">Eligible</TableHead>
                  <TableHead className="text-right">Done so far</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.categories.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell>
                      <div className="font-medium">{c.label}</div>
                      <div className="text-muted-foreground text-xs">
                        {c.action === 'PURGE_FILE' ? 'Purge file' : 'Restrict record'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.configured ? (
                        <>
                          {c.days} days
                          <div className="text-muted-foreground">
                            before {c.cutoff ? formatDateTime(c.cutoff) : ''}
                          </div>
                        </>
                      ) : (
                        <Badge variant="unknown" className="whitespace-nowrap">
                          not set
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {n(c.olderThanCutoff)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{n(c.onHold)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(c.protected)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {n(c.eligible)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{n(c.alreadyDone)}</TableCell>
                    <TableCell>
                      <RunRetention
                        category={c.category}
                        label={c.label}
                        runnable={c.configured && c.runnable}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Never removed by retention: {plan.neverRemoved.join(' · ')}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal holds</CardTitle>
          <CardDescription>
            Anything on hold is skipped by every retention run until the hold is released. Placing
            and releasing holds is audited.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <LegalHoldForm />
          {allHolds.length ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Id</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allHolds.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.label}</TableCell>
                      <TableCell className="font-mono text-xs">{h.id}</TableCell>
                      <TableCell className="text-xs">{h.reason}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(h.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No items are on legal hold.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
