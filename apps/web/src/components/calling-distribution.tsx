import { type CallingQueueRow } from '@kbs/shared';
import { CircleAlert, CircleCheck, Contact, TriangleAlert, Users } from 'lucide-react';

import { DistributionRecordsTable } from '@/components/calling-distribution-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, Callout, EmptyState, humanize, Meter, PillNav, SectionCard } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface DistributionRow {
  id: string;
  fullName: string;
  employeeCode: string | null;
  status: string;
  trained: boolean;
  eligible: boolean;
  active: number;
  byStatus: Record<string, number>;
  needsReassignment: boolean;
}
interface Distribution {
  telecallers: DistributionRow[];
  unassigned: number | null;
}

const TAB_LABEL = { active: 'Active', followups: 'Follow-ups', hidden: 'Hidden' } as const;

/** F-305 §6 / F-307 §4: distribution + scoped records with reassignment (Manager: team; Admin: all). */
export async function CallingDistribution({
  scope,
  telecallerId,
  tab = 'active',
}: {
  scope: 'manager' | 'admin';
  telecallerId?: string;
  tab?: 'active' | 'followups' | 'hidden';
}) {
  const [dist, records] = await Promise.all([
    apiFetch<Distribution>('/calling/distribution'),
    apiFetch<CallingQueueRow[]>(
      `/calling/records?tab=${tab}&pageSize=100${telecallerId ? `&telecallerId=${telecallerId}` : ''}`,
    ),
  ]);
  const base = scope === 'manager' ? '/manager/calling' : '/admin/calling-list/distribution';
  const eligible = dist.data.telecallers.filter((t) => t.eligible);
  const totalActive = dist.data.telecallers.reduce((n, t) => n + t.active, 0);
  const unassigned = dist.data.unassigned;
  const tabHref = (t: keyof typeof TAB_LABEL) => `${base}?tab=${t}${telecallerId ? `&telecallerId=${telecallerId}` : ''}`;
  const recordCount = Number(records.meta.total ?? records.data.length);
  return (
    <div className="grid gap-6">
      <SectionCard
        icon={Users}
        tone="violet"
        title="Distribution"
        description="Active records per Telecaller. Deactivated Telecallers still holding records are flagged — reassign them."
      >
        <div className="grid gap-4">
          {unassigned !== null ? (
            <Callout tone={unassigned > 0 ? 'warning' : 'success'} icon={unassigned > 0 ? TriangleAlert : CircleCheck}>
              <span className="font-semibold tabular-nums">{unassigned}</span> accepted records unassigned (no eligible Telecaller or consent gate)
            </Callout>
          ) : null}
          {dist.data.telecallers.length === 0 ? (
            <EmptyState icon={Users} title="No Telecallers yet" description="Records are allocated only to active, training-complete Telecallers." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dist.data.telecallers.map((t) => {
                const breakdown = Object.entries(t.byStatus);
                return (
                  <li
                    key={t.id}
                    className={cn(
                      'flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]',
                      t.needsReassignment ? 'border-rose-200' : telecallerId === t.id ? 'border-teal-300 ring-2 ring-teal-100' : 'border-slate-200/80',
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={t.fullName} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-900">{t.fullName}</div>
                        {t.employeeCode ? <div className="truncate text-xs text-slate-500">{t.employeeCode}</div> : null}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Badge variant={t.status === 'ACTIVE' ? 'success' : 'unknown'}>{humanize(t.status)}</Badge>
                          {t.eligible ? (
                            <Badge variant="success">trained</Badge>
                          ) : (
                            <Badge variant="warning">{t.trained ? 'inactive' : 'training pending'}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-600">Active records</span>
                        <span className="text-lg font-semibold text-slate-900 tabular-nums">{t.active}</span>
                      </div>
                      <Meter value={t.active} max={totalActive} tone={t.needsReassignment ? 'rose' : 'violet'} label={`${t.fullName} active records`} />
                      <p className="text-[11px] text-slate-500">
                        {totalActive > 0 ? `${Math.round((t.active / totalActive) * 100)}% of ${totalActive} active records` : 'No active records'}
                      </p>
                    </div>
                    {t.needsReassignment ? (
                      <Badge variant="destructive">
                        <CircleAlert />
                        needs reassignment
                      </Badge>
                    ) : null}
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      {breakdown.length ? (
                        breakdown.map(([k, n]) => (
                          <span key={k} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">
                            {k.toLowerCase().replace('_', ' ')} <span className="font-semibold tabular-nums">{n}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                    <div className="mt-auto border-t border-slate-100 pt-3">
                      <a className="text-[13px] font-medium text-teal-700 hover:text-teal-800" href={`${base}?telecallerId=${t.id}`}>
                        view records
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SectionCard>
      <SectionCard
        icon={Contact}
        tone="sky"
        title={`Records${telecallerId ? ' — selected Telecaller' : ''}`}
        description={`${String(records.meta.total ?? records.data.length)} rows · mobiles masked (REQ-08 §8.3)`}
        actions={
          <PillNav
            label="Record tabs"
            active={tabHref(tab)}
            items={(['active', 'followups', 'hidden'] as const).map((t) => ({ href: tabHref(t), label: TAB_LABEL[t], count: t === tab ? recordCount : null }))}
          />
        }
        flush={records.data.length > 0}
      >
        <DistributionRecordsTable rows={records.data} eligible={eligible.map((t) => ({ id: t.id, label: t.fullName }))} />
      </SectionCard>
    </div>
  );
}
