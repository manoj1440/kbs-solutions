import { formatDateTime, type PendingAction } from '@kbs/shared';
import { CalendarClock, ClipboardList, FileSpreadsheet, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, IconTile, MiniStat, StatStrip } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Pending actions · KBS Solutions' };

/** F-409 → F-811 (Manager): concrete pending actions across the team — owner / what / source / date. Nothing is invented from blank bank values. */
export default async function ManagerPendingActionsPage() {
  const r = await apiFetch<PendingAction[]>('/pending-actions');
  const tasks = r.data.filter((a) => a.source.type === 'KBS_TASK').length;
  const bank = r.data.length - tasks;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Pending actions</h1>
      <StatStrip cols={3}>
        <MiniStat label="Pending actions" value={r.data.length} hint="Across your team" tone={r.data.length ? 'amber' : 'slate'} />
        <MiniStat label="Follow-up tasks" value={tasks} hint="Created in KBS" tone="sky" />
        <MiniStat label="From bank status" value={bank} hint="Set up by Admin" tone="indigo" />
      </StatStrip>
      <section aria-label="Pending actions" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {r.data.length === 0 ? (
            <EmptyState icon={ClipboardList} className="m-3" title="No pending actions." description="Follow-up tasks and bank-status actions will appear here." />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {r.data.map((a) => (
                <li key={a.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                  <IconTile icon={a.source.type === 'KBS_TASK' ? CalendarClock : FileSpreadsheet} tone={a.source.type === 'KBS_TASK' ? 'sky' : 'indigo'} size="sm" className="hidden sm:inline-flex" />
                  <div className="grid min-w-0 gap-1.5">
                    <p className="text-sm font-semibold break-words text-foreground">{a.whatToDo}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Link href={`/manager/leads/${a.leadId}`} className="font-mono font-medium text-neutral-900 hover:text-neutral-950">
                        {a.leadRef}
                      </Link>
                      <span aria-hidden="true">·</span>
                      <span className="text-fg-2">{a.customer}</span>
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
                          Bank · {a.source.field}
                          {a.source.batchRef ? ` · ${a.source.batchRef}` : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:grid sm:justify-items-end sm:gap-1.5 sm:text-right">
                    <span className="inline-flex items-center gap-2 text-xs text-fg-2">
                      {a.owner.name ? (
                        <>
                          <Avatar name={a.owner.name} size="sm" className="size-6 text-[9px]" />
                          {a.owner.name}
                        </>
                      ) : (
                        <>
                          <UserRound className="size-4 text-fg-3" aria-hidden="true" />
                          <span className="text-muted-foreground">{a.owner.role === 'BANK' ? 'Bank (informational)' : '—'}</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(a.date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
