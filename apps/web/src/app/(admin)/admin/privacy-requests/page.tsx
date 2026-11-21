import { DATA_REQUEST_STATUSES, DATA_REQUEST_STATUS_LABEL, DATA_REQUEST_TARGET_DAYS, DATA_REQUEST_TYPES, DATA_REQUEST_TYPE_LABEL, type DataRequestAdminView } from '@kbs/shared';
import { Filter } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { DataTablePagination, DataTablePanel } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { MiniStat, PillNav, selectClass, StatStrip } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { RequestsTable } from './requests-table';

export const metadata = { title: 'Privacy requests' };

type Search = { queue?: string; status?: string; type?: string; page?: string };
const PAGE_SIZE = 50;
const BASE = '/admin/privacy-requests';

/** F-908: the Admin's data-principal request queue (access, correction, erasure, grievance). Oldest deadline first. */
export default async function PrivacyRequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const queue = sp.queue === 'closed' || sp.queue === 'all' ? sp.queue : 'open';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const qs = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
  if (queue !== 'all') qs.set('queue', queue);
  if (sp.status && (DATA_REQUEST_STATUSES as string[]).includes(sp.status)) qs.set('status', sp.status);
  if (sp.type && (DATA_REQUEST_TYPES as string[]).includes(sp.type)) qs.set('type', sp.type);
  const r = await apiFetch<DataRequestAdminView[]>(`/privacy/requests?${qs}`);
  const total = Number(r.meta.total ?? r.data.length);
  const counts = (r.meta.counts ?? {}) as Partial<Record<string, number>>;
  const href = (p: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ queue, type: sp.type, status: sp.status, ...p })) if (v) n.set(k, v);
    return `${BASE}?${n}`;
  };
  const filtered = Boolean(sp.type || sp.status);
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Privacy requests</h1>
      <StatStrip cols={4}>
        <MiniStat label="Received" value={counts.OPEN ?? 0} hint="Not picked up yet" tone={counts.OPEN ? 'sky' : 'slate'} />
        <MiniStat label="In progress" value={counts.IN_PROGRESS ?? 0} hint="Being worked on" tone={counts.IN_PROGRESS ? 'amber' : 'slate'} />
        <MiniStat label="Overdue" value={counts.overdue ?? 0} hint={`Past the ${DATA_REQUEST_TARGET_DAYS}-day target`} tone={counts.overdue ? 'rose' : 'slate'} />
        <MiniStat label="Closed" value={(counts.COMPLETED ?? 0) + (counts.REJECTED ?? 0)} hint="Completed or declined" tone="emerald" />
      </StatStrip>
      <DataTablePanel
        label="Privacy requests"
        toolbar={
          <>
            <PillNav
              label="Request queues"
              active={`${BASE}?queue=${queue}`}
              items={[
                { href: `${BASE}?queue=open`, label: 'Open' },
                { href: `${BASE}?queue=closed`, label: 'Closed' },
                { href: `${BASE}?queue=all`, label: 'All' },
              ]}
            />
            <Form action={BASE} className="ml-auto flex flex-wrap items-center gap-2">
              <input type="hidden" name="queue" value={queue} />
              <select aria-label="Request type" name="type" defaultValue={sp.type ?? ''} className={cn(selectClass, 'h-9 min-w-40')}>
                <option value="">Every type</option>
                {DATA_REQUEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DATA_REQUEST_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <select aria-label="Status" name="status" defaultValue={sp.status ?? ''} className={cn(selectClass, 'h-9 min-w-36')}>
                <option value="">Any status</option>
                {DATA_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {DATA_REQUEST_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <Button variant="outline" type="submit" size="sm" className="h-9">
                <Filter />
                Apply
              </Button>
              {filtered ? (
                <Button asChild size="sm" variant="ghost" className="h-9">
                  <Link href={`${BASE}?queue=${queue}`}>Reset</Link>
                </Button>
              ) : null}
            </Form>
          </>
        }
        footer={<DataTablePagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: String(p) })} noun="requests" />}
      >
        <RequestsTable rows={r.data} filtered={filtered} />
      </DataTablePanel>
    </div>
  );
}
