import { formatDateTime } from '@kbs/shared';
import { ArrowLeft, Ban, Check, Copy, FileSpreadsheet, Fingerprint, Info, Link2Off, Rows3, ScanLine, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, BankMark, Callout, humanize, PageHeader, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { type MisJob, PipelineActions } from './pipeline';
import { BatchRows } from './rows';

interface PreviewReport {
  generatedAt: string;
  totals: Record<string, number>;
  referenceCoverage: number;
  blankStatusCounts: Record<string, number>;
  newValues: Record<string, string[]>;
  duplicateReferences: { reference: string; rows: number }[];
  samples: Record<string, { row: number; customer: string; references: { kind: string; value: string }[]; explanation: string | null }[]>;
}
interface Batch {
  id: string;
  publicRef: string;
  stage: string;
  uploadedAt: string;
  sheetName: string | null;
  totals: Record<string, unknown> | null;
  preview: { headers?: string[]; resolved?: Record<string, string>; missing?: string[]; unmapped?: string[]; report?: PreviewReport } | null;
  rejectReason: string | null;
  appliedAt: string | null;
  bank: { code: string; displayName: string };
  profile: { id: string; name: string; version: number; snapshotMode: string };
  file: { originalName: string; sizeBytes: number };
  uploader: { fullName: string; role: string };
}

const STAGE_TONE: Record<string, 'info' | 'warning' | 'success' | 'destructive' | 'unknown'> = { UPLOADED: 'info', PARSED: 'info', MAPPED: 'warning', PREVIEWED: 'warning', APPLYING: 'info', APPLIED: 'success', FAILED: 'destructive', REJECTED: 'destructive' };
const STEPS = [
  { key: 'UPLOADED', label: 'Uploaded', hint: 'File stored immutably' },
  { key: 'PARSED', label: 'Parsed', hint: 'Every cell kept as text' },
  { key: 'MAPPED', label: 'Mapped', hint: 'Headers resolved to fields' },
  { key: 'PREVIEWED', label: 'Previewed', hint: 'Dry-run match to leads' },
  { key: 'APPLIED', label: 'Applied', hint: 'Writes bank status' },
] as const;
type StepState = 'done' | 'next' | 'running' | 'failed' | 'todo' | 'stopped' | 'rejected';

/** Presentation of the batch stage only — each stage means that step is complete. */
function stepStates(stage: string): StepState[] {
  if (stage === 'REJECTED') return ['stopped', 'stopped', 'stopped', 'stopped', 'rejected'];
  const reached = { UPLOADED: 0, PARSED: 1, MAPPED: 2, PREVIEWED: 3, APPLYING: 3, FAILED: 3, APPLIED: 4 }[stage] ?? -1;
  return STEPS.map((_, i) => {
    if (i <= reached) return 'done';
    if (i === reached + 1) return stage === 'APPLYING' ? 'running' : stage === 'FAILED' ? 'failed' : 'next';
    return 'todo';
  });
}
const STEP_TEXT: Record<StepState, string> = { done: 'Done', next: 'Next', running: 'In progress', failed: 'Failed', todo: 'Pending', stopped: '—', rejected: 'Rejected' };

function Stepper({ stage }: { stage: string }) {
  const states = stepStates(stage);
  return (
    <ol aria-label="Batch pipeline" className="grid gap-4 sm:grid-cols-5 sm:gap-3">
      {STEPS.map((s, i) => {
        const st = states[i];
        const label = st === 'rejected' ? 'Rejected' : s.label;
        return (
          <li
            key={s.key}
            aria-current={st === 'next' || st === 'running' || st === 'failed' ? 'step' : undefined}
            className={cn(
              'relative flex min-w-0 items-start gap-3 sm:flex-col sm:gap-2',
              'after:absolute after:rounded-full last:after:hidden max-sm:after:top-9 max-sm:after:-bottom-3 max-sm:after:left-[15px] max-sm:after:w-0.5 sm:after:top-[15px] sm:after:-right-1.5 sm:after:left-10 sm:after:h-0.5',
              st === 'done' ? 'after:bg-teal-500' : 'after:bg-slate-200',
            )}
          >
            <span
              className={cn(
                'relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums [&>svg]:size-4',
                st === 'done' && 'bg-teal-600 text-white shadow-sm',
                st === 'next' && 'bg-white text-teal-700 ring-2 ring-teal-600',
                st === 'running' && 'bg-sky-50 text-sky-700 ring-2 ring-sky-500',
                st === 'failed' && 'bg-rose-600 text-white shadow-sm',
                st === 'rejected' && 'bg-slate-700 text-white shadow-sm',
                (st === 'todo' || st === 'stopped') && 'bg-slate-100 text-slate-400 ring-1 ring-slate-200',
              )}
            >
              {st === 'done' ? <Check aria-hidden="true" /> : st === 'failed' ? <X aria-hidden="true" /> : st === 'rejected' ? <Ban aria-hidden="true" /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cn('text-[13px] leading-5 font-semibold', st === 'todo' || st === 'stopped' ? 'text-slate-500' : 'text-slate-900')}>{label}</p>
              <p
                className={cn(
                  'text-[11px] leading-4',
                  st === 'next' ? 'font-semibold text-teal-700' : st === 'running' ? 'font-semibold text-sky-700' : st === 'failed' ? 'font-semibold text-rose-700' : st === 'rejected' ? 'font-semibold text-slate-700' : 'text-slate-500',
                )}
              >
                {st === 'done' || st === 'todo' || st === 'stopped' ? s.hint : STEP_TEXT[st]}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function MisBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [b, jobStatus] = await Promise.all([apiFetch<Batch>(`/mis/batches/${id}`).then((r) => r.data), apiFetch<{ job: MisJob }>(`/mis/batches/${id}/job`).then((r) => r.data.job)]);
  const totals = (b.totals ?? {}) as { rows?: number; unique?: number; duplicateRows?: number; invalid?: number; missingHeaders?: string[]; unmappedColumns?: string[] };
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={FileSpreadsheet}
        eyebrow="Bank data & finance"
        title={`MIS batch ${b.publicRef}`}
        description={`${b.bank.displayName} · ${b.profile.name} v${b.profile.version}`}
        meta={
          <>
            <Badge variant={STAGE_TONE[b.stage] ?? 'unknown'}>{humanize(b.stage)}</Badge>
            <span>Uploaded {formatDateTime(b.uploadedAt)}</span>
            {b.appliedAt ? <span>· Applied {formatDateTime(b.appliedAt)}</span> : null}
          </>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/mis">
              <ArrowLeft />
              MIS imports
            </Link>
          </Button>
        }
      >
        <section aria-label="Batch summary" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)]">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <BankMark code={b.bank.code} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-slate-900">{b.bank.displayName}</p>
                <p className="text-[12.5px] text-slate-500">
                  <Link href={`/admin/mis/profiles/${b.profile.id}`} className="font-medium text-teal-700 hover:text-teal-800">
                    {b.profile.name} v{b.profile.version}
                  </Link>
                </p>
                <p className="text-[11px] text-slate-500">{humanize(b.profile.snapshotMode)} mode</p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">File</dt>
                <dd className="mt-1 flex min-w-0 items-center gap-1.5 text-slate-900">
                  <FileSpreadsheet className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="min-w-0 break-words">{b.file.originalName}</span>
                </dd>
                <dd className="text-[11px] text-slate-500 tabular-nums">{size(b.file.sizeBytes)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Sheet</dt>
                <dd className="mt-1 break-words text-slate-900">“{b.sheetName}”</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Uploaded by</dt>
                <dd className="mt-1 flex min-w-0 items-center gap-2">
                  <Avatar name={b.uploader.fullName} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">{b.uploader.fullName}</span>
                    <span className="block text-[11px] text-slate-500">{humanize(b.uploader.role)}</span>
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6">
            <Stepper stage={b.stage} />
          </div>
        </section>
      </PageHeader>
      {b.rejectReason ? (
        <Callout tone="danger" icon={Ban} role="alert">
          Rejected: {b.rejectReason}
        </Callout>
      ) : null}
      <SectionCard icon={ScanLine} tone="sky" title="Parse & map" description="Every cell stored as text; rows hashed; references extracted in profile order.">
        <div className="grid gap-4">
          <StatGrid>
            <StatCard label="Rows" value={totals.rows ?? '—'} hint="Data rows read from the sheet" icon={Rows3} tone="sky" />
            <StatCard label="Unique" value={totals.unique ?? '—'} hint="Stored after dropping identical rows" icon={Fingerprint} tone="indigo" />
            <StatCard label="Duplicate rows" value={totals.duplicateRows ?? 0} hint="Identical to an earlier row in this file" icon={Copy} tone={totals.duplicateRows ? 'amber' : 'slate'} />
            <StatCard label="No reference" value={totals.invalid ?? 0} hint="No usable bank reference in the row" icon={Link2Off} tone={totals.invalid ? 'rose' : 'slate'} />
          </StatGrid>
          {totals.missingHeaders?.length ? (
            <Callout tone="warning" icon={TriangleAlert}>
              Profile headers not found in file: {totals.missingHeaders.join(', ')}
            </Callout>
          ) : null}
          {totals.unmappedColumns?.length ? (
            <Callout tone="neutral" icon={Info}>
              Unmapped columns kept in raw: {totals.unmappedColumns.join(', ')}
            </Callout>
          ) : null}
        </div>
      </SectionCard>
      <PipelineActions job={jobStatus} batchId={b.id} stage={b.stage} report={b.preview?.report ?? null} totals={b.totals as Record<string, number> | null} profileId={b.profile.id} />
      <BatchRows batchId={b.id} stage={b.stage} />
    </div>
  );
}
