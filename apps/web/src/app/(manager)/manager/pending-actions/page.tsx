import { formatDateTime, type PendingAction } from '@kbs/shared';
import { CalendarClock, ClipboardList, FileSpreadsheet, ListTodo, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, IconTile, PageHeader, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

/** F-409 (Manager): concrete pending actions across the team — owner / what / source / date. Nothing is invented from blank MIS cells. */
export default async function ManagerPendingActionsPage() {
  const r = await apiFetch<PendingAction[]>('/pending-actions');
  const tasks = r.data.filter((a) => a.source.type === 'KBS_TASK').length;
  const bank = r.data.length - tasks;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={ClipboardList}
        tone="amber"
        eyebrow="Leads"
        title="Pending actions"
        description="Explicit follow-up tasks and Admin-configured MIS rules only. A blank or generic bank value never creates a task."
      >
        <StatGrid className="xl:grid-cols-3">
          <StatCard label="Pending actions" value={r.data.length} hint="Across your team" icon={ListTodo} tone={r.data.length ? 'amber' : 'slate'} className="col-span-2 xl:col-span-1" />
          <StatCard label="Follow-up tasks" value={tasks} hint="Created in KBS" icon={CalendarClock} tone="sky" />
          <StatCard label="From bank MIS" value={bank} hint="Admin-configured MIS rules" icon={FileSpreadsheet} tone="indigo" />
        </StatGrid>
      </PageHeader>

      <SectionCard
        icon={ListTodo}
        tone="amber"
        title={`${r.data.length} item(s)`}
        description="Ordered by date. Bank-sourced items show the exact bank text and the batch it came from."
        flush={r.data.length > 0}
      >
        {r.data.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No pending actions." description="Follow-up tasks and matching MIS rules will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {r.data.map((a) => (
              <li key={a.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:px-6">
                <IconTile
                  icon={a.source.type === 'KBS_TASK' ? CalendarClock : FileSpreadsheet}
                  tone={a.source.type === 'KBS_TASK' ? 'sky' : 'indigo'}
                  size="sm"
                  className="hidden sm:inline-flex"
                />
                <div className="grid min-w-0 gap-1.5">
                  <p className="text-sm font-semibold break-words text-slate-900">{a.whatToDo}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-500">
                    <Link href={`/manager/leads/${a.leadId}`} className="font-mono font-medium text-teal-700 hover:text-teal-900">
                      {a.leadRef}
                    </Link>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-700">{a.customer}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {a.issuer} · {a.card}
                    </span>
                  </div>
                  <div>
                    {a.source.type === 'KBS_TASK' ? (
                      <Badge variant="info">Follow-up task</Badge>
                    ) : (
                      <Badge variant="secondary" className="max-w-full whitespace-normal">
                        Bank MIS · {a.source.field}
                        {a.source.batchRef ? ` · ${a.source.batchRef}` : ''}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:grid sm:justify-items-end sm:gap-1.5 sm:text-right">
                  <span className="inline-flex items-center gap-2 text-[12.5px] text-slate-700">
                    {a.owner.name ? (
                      <>
                        <Avatar name={a.owner.name} size="sm" className="size-6 text-[9px]" />
                        {a.owner.name}
                      </>
                    ) : (
                      <>
                        <UserRound className="size-4 text-slate-400" aria-hidden="true" />
                        <span className="text-slate-500">{a.owner.role === 'BANK' ? 'Bank (informational)' : '—'}</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(a.date)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
