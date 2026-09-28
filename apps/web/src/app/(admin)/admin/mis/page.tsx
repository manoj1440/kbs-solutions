import { Filter, TriangleAlert } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { DataTablePagination, DataTablePanel } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { humanize, MiniStat, selectClass } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { MisApplicationsTable, type MisApplication } from './mis-applications-table';
import { UploadMisButton } from './new-batch';

export const metadata = { title: 'Bank MIS · KBS Solutions' };

const PAGE_SIZE = 50;

interface Profile {
  id: string;
  name: string;
  version: number;
  status: string;
  bank: { id: string; code: string; displayName: string };
}
interface Batch {
  id: string;
  publicRef: string;
  stage: string;
  totals: { rows?: number } | null;
  rejectReason: string | null;
  bank: { code: string };
}
interface Summary {
  total: number;
  approved: number;
  declined: number;
  inProcess: number;
  decisionBlank: number;
  cardsActive: number;
  cardsInactive: number;
  activationBlank: number;
  values: { stages: string[]; decisions: string[]; activations: string[] };
}
interface Bank {
  id: string;
  code: string;
  displayName: string;
}

/** Batches not APPLIED need attention (still running, or stopped). */
const LIVE = new Set(['UPLOADED', 'PARSED', 'MAPPED', 'PREVIEWED', 'APPLYING', 'FAILED']);

/**
 * F-809 Bank MIS: cumulative record counts, every bank-reported application (filters, 50/page, internal scroll)
 * and one-step upload (bank + file → auto apply). Values are bank-verbatim (INV-02/03).
 */
export default async function MisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.bankId) qs.set('bankId', sp.bankId);
  if (sp.q?.trim()) qs.set('q', sp.q.trim());
  if (sp.stage) qs.set('stage', sp.stage);
  if (sp.decision) qs.set('decision', sp.decision);
  if (sp.activation) qs.set('activation', sp.activation);
  const [summary, applications, batches, profiles, banks] = await Promise.all([
    apiFetch<Summary>('/mis/applications/summary').then((r) => r.data),
    apiFetch<MisApplication[]>(`/mis/applications?${qs.toString()}`),
    apiFetch<Batch[]>('/mis/batches?pageSize=50'),
    apiFetch<Profile[]>('/mis/profiles').then((r) => r.data),
    apiFetch<Bank[]>('/catalogue/banks').then((r) => r.data),
  ]);
  const approvedProfiles = profiles.filter((p) => p.status === 'APPROVED');
  const uploadBanks = banks.filter((b) => approvedProfiles.some((p) => p.bank.id === b.id)).map((b) => ({ id: b.id, label: b.displayName }));
  const total = Number(applications.meta.total ?? applications.data.length);
  const pending = batches.data.filter((b) => LIVE.has(b.stage));
  const filtered = Boolean(sp.bankId || sp.q || sp.stage || sp.decision || sp.activation);
  const link = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, bankId: sp.bankId, stage: sp.stage, decision: sp.decision, activation: sp.activation, ...over })) if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/mis${s ? `?${s}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Bank MIS</h1>
      {pending.length ? (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <TriangleAlert className="size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          {pending.map((b) => (
            <Link key={b.id} href={`/admin/mis/batches/${b.id}`} className="font-medium underline-offset-2 hover:underline">
              <span className="font-mono">{b.publicRef}</span> ({b.bank.code}) → {b.stage === 'FAILED' ? `Failed${b.rejectReason ? `: ${b.rejectReason}` : ''}` : humanize(b.stage)}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Applications reported" value={summary.total.toLocaleString('en-IN')} hint="Latest bank-reported state per application" tone="sky" />
        <MiniStat label="Approved" value={summary.approved} hint="Bank decision = approved" tone="emerald" />
        <MiniStat label="Declined" value={summary.declined} hint="Bank decision = declined/rejected" tone="rose" />
        <MiniStat label="In process" value={summary.inProcess} hint="Decision reported, not final" tone="amber" />
        <MiniStat label="Cards active" value={summary.cardsActive} hint={`${summary.cardsInactive} reported inactive`} tone="teal" />
        <MiniStat label="Not reported" value={summary.decisionBlank} hint={`No decision · ${summary.activationBlank} no activation`} tone="slate" />
      </div>

      <DataTablePanel
        label="Bank MIS applications"
        toolbar={
          <>
            <Form action="/admin/mis" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <input aria-label="Search" name="q" className={cn(selectClass, 'h-9 min-w-44 flex-[2_1_12rem]')} defaultValue={sp.q ?? ''} placeholder="Application / ref / customer / code" />
              <select aria-label="Bank" name="bankId" className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')} defaultValue={sp.bankId ?? ''}>
                <option value="">All banks</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </select>
              <select aria-label="Stage" name="stage" className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')} defaultValue={sp.stage ?? ''}>
                <option value="">Any stage</option>
                {summary.values.stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select aria-label="Decision" name="decision" className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')} defaultValue={sp.decision ?? ''}>
                <option value="">Any decision</option>
                {summary.values.decisions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select aria-label="Card activation" name="activation" className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')} defaultValue={sp.activation ?? ''}>
                <option value="">Any activation</option>
                {summary.values.activations.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" className="h-9">
                <Filter />
                Apply
              </Button>
              {filtered ? (
                <Button asChild size="sm" variant="ghost" className="h-9">
                  <Link href="/admin/mis">Reset</Link>
                </Button>
              ) : null}
            </Form>
            <UploadMisButton banks={uploadBanks} />
          </>
        }
        footer={
          <DataTablePagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => link({ page: String(p) })} noun="applications" />
        }
      >
        <MisApplicationsTable rows={applications.data} filtered={filtered} />
      </DataTablePanel>
    </div>
  );
}
