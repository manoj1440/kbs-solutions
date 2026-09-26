import { formatDateTime } from '@kbs/shared';
import {
  Archive,
  FileX2,
  FlaskConical,
  Gavel,
  Hourglass,
  OctagonAlert,
  ScanSearch,
  ShieldCheck,
  UserRoundX,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Callout,
  EmptyState,
  IconTile,
  Meter,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
} from '@/components/ui/kit';
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
  const blocked = unset.length > 0 || !plan.executionEnabled;
  const nightly = plan.scheduleEnabled && plan.executionEnabled;
  const configured = plan.categories.length - unset.length;
  const counted = plan.categories.filter((c) => c.eligible !== null);
  const eligible = counted.reduce((sum, c) => sum + (c.eligible ?? 0), 0);
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Archive}
        eyebrow="Administration"
        title="Data retention & legal hold"
        tone="amber"
        description="Files past their retention period are purged from storage (the record of the file stays). Calling records are restricted — personal details removed and hidden from queues — never deleted."
      >
        <StatGrid>
          <StatCard
            label="Retention runs"
            value={blocked ? 'Blocked' : 'Ready'}
            hint={`Execution ${plan.executionEnabled ? 'enabled' : 'disabled'} · nightly run ${nightly ? 'on' : 'off'}`}
            icon={blocked ? OctagonAlert : ShieldCheck}
            tone={blocked ? 'rose' : 'emerald'}
          />
          <StatCard
            label="Durations set"
            icon={Hourglass}
            tone={unset.length ? 'amber' : 'emerald'}
            value={
              <>
                {configured}
                <span className="text-base font-medium text-slate-400">
                  {' '}
                  of {plan.categories.length}
                </span>
                <Meter
                  value={configured}
                  max={plan.categories.length}
                  tone={unset.length ? 'amber' : 'emerald'}
                  className="mt-2.5"
                  label="Retention durations set"
                />
              </>
            }
            hint={
              unset.length
                ? 'Awaiting KBS approval (REQ-21 §21.5)'
                : 'Every category has a duration'
            }
          />
          <StatCard
            label="Eligible now"
            value={counted.length ? n(eligible) : '—'}
            hint={
              counted.length
                ? 'Dry run across configured categories'
                : 'No category has a duration yet'
            }
            icon={ScanSearch}
            tone="sky"
          />
          <StatCard
            label="Legal holds"
            value={n(allHolds.length)}
            hint="Files and calling records on hold"
            icon={Gavel}
            tone="violet"
          />
        </StatGrid>
      </PageHeader>

      {blocked ? (
        <Callout
          tone="warning"
          icon={OctagonAlert}
          role="status"
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge variant="warning">Blocked</Badge> Retention is not running
            </span>
          }
        >
          <p>
            KBS has not approved retention durations yet (REQ-21 §21.5 OPEN). Nothing is purged or
            restricted until each duration is set and{' '}
            <span className="font-mono">retention.executionEnabled</span> is turned on in{' '}
            <Link className="font-medium underline underline-offset-2" href="/admin/config">
              Configuration
            </Link>
            .
          </p>
          {unset.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span>Missing:</span>
              {unset.map((c) => (
                <code
                  key={c.configKey}
                  className="rounded-md bg-white px-2 py-0.5 font-mono text-xs break-all text-amber-900 ring-1 ring-amber-200"
                >
                  {c.configKey}
                </code>
              ))}
            </div>
          ) : null}
        </Callout>
      ) : null}

      <SectionCard
        icon={FlaskConical}
        tone="sky"
        title="Dry run"
        description={
          <>
            Nightly run (02:00 IST):{' '}
            <Badge variant={nightly ? 'success' : 'unknown'}>{nightly ? 'on' : 'off'}</Badge> —
            needs <span className="font-mono">retention.scheduleEnabled</span> and{' '}
            <span className="font-mono">retention.executionEnabled</span>; only categories with a
            set duration run.
          </>
        }
        flush
      >
        <p className="px-5 pb-4 text-[12.5px] leading-relaxed text-slate-500 sm:px-6">
          Counts are computed live and change nothing. Protected items are kept for a legitimate
          obligation (payout proofs, live cheques and ID cards, MIS files still being processed,
          quarantined uploads).
        </p>
        <Table responsive="compact">
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
                <TableCell data-label="Category">
                  <div className="flex items-center gap-2.5">
                    <IconTile
                      icon={c.action === 'PURGE_FILE' ? FileX2 : UserRoundX}
                      tone={c.action === 'PURGE_FILE' ? 'rose' : 'violet'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{c.label}</div>
                      <div className="text-xs text-slate-500">
                        {c.action === 'PURGE_FILE' ? 'Purge file' : 'Restrict record'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell data-label="Retention" className="text-xs">
                  {c.configured ? (
                    <>
                      <span className="font-medium text-slate-800 tabular-nums">{c.days} days</span>
                      <div className="text-slate-500">
                        before {c.cutoff ? formatDateTime(c.cutoff) : ''}
                      </div>
                    </>
                  ) : (
                    <Badge variant="unknown" className="whitespace-nowrap">
                      not set
                    </Badge>
                  )}
                </TableCell>
                <TableCell data-label="Past cutoff" className="tabular-nums sm:text-right">
                  {n(c.olderThanCutoff)}
                </TableCell>
                <TableCell data-label="Legal hold" className="tabular-nums sm:text-right">
                  {n(c.onHold)}
                </TableCell>
                <TableCell data-label="Protected" className="tabular-nums sm:text-right">
                  {n(c.protected)}
                </TableCell>
                <TableCell
                  data-label="Eligible"
                  className="font-semibold text-slate-900 tabular-nums sm:text-right"
                >
                  {n(c.eligible)}
                </TableCell>
                <TableCell data-label="Done so far" className="tabular-nums sm:text-right">
                  {n(c.alreadyDone)}
                </TableCell>
                <TableCell className="sm:text-right">
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
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-600 sm:px-6">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p>Never removed by retention: {plan.neverRemoved.join(' · ')}.</p>
        </div>
      </SectionCard>

      <SectionCard
        icon={Gavel}
        tone="violet"
        title="Legal holds"
        description="Anything on hold is skipped by every retention run until the hold is released. Placing and releasing holds is audited."
        flush
      >
        <div className="px-5 pb-5 sm:px-6">
          <LegalHoldForm />
        </div>
        {allHolds.length ? (
          <Table responsive>
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
                  <TableCell data-label="Item" className="font-medium text-slate-800">
                    {h.label}
                  </TableCell>
                  <TableCell data-label="Id" className="font-mono text-xs break-all text-slate-600">
                    {h.id}
                  </TableCell>
                  <TableCell data-label="Reason" className="text-xs text-slate-600">
                    {h.reason}
                  </TableCell>
                  <TableCell data-label="Created" className="text-xs text-slate-600">
                    {formatDateTime(h.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-5 pb-5 sm:px-6">
            <EmptyState
              className="py-7"
              icon={Gavel}
              title="No items are on legal hold."
              description="Place a hold above by file or calling-record id to exclude it from every retention run."
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
