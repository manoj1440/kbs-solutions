import { Download, Eye, History, Lock } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { DataTablePagination } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { PillNav, selectClass } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { AuditActionsTable, type AuditRow, SensitiveAccessTable, type SensitiveRow } from './audit-tables';

export const metadata = { title: 'Audit · KBS Solutions' };

interface Catalogue {
  groups: { key: string; label: string; actions: { action: string; count: number }[] }[];
  other: { action: string; count: number }[];
  entityTypes: string[];
}
interface UserRow {
  id: string;
  fullName: string;
  role: string;
}
/** F-704 → F-811 audit (REQ-16 §16.2, REQ-24 §24.3). Read-only; export follows audit.exportEnabled. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'sensitive' ? 'sensitive' : 'actions';
  const qs = new URLSearchParams();
  for (const k of ['group', 'action', 'actorUserId', 'entityType', 'entityId', 'from', 'to', 'page']) if (sp[k]) qs.set(k, sp[k] as string);
  qs.set('pageSize', '50');
  const [cat, users, list] = await Promise.all([
    apiFetch<Catalogue>('/audit/actions').then((r) => r.data),
    apiFetch<UserRow[]>('/users?pageSize=200').then((r) => r.data).catch(() => [] as UserRow[]),
    tab === 'actions' ? apiFetch<AuditRow[]>(`/audit?${qs.toString()}`) : apiFetch<SensitiveRow[]>(`/audit/sensitive-access?${qs.toString()}`),
  ]);
  const exportEnabled = Boolean((list.meta as { exportEnabled?: boolean }).exportEnabled);
  const page = Number(sp.page ?? 1);
  const total = Number(list.meta.total ?? 0);
  const link = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) q.set(k, v);
    return `/admin/audit?${q.toString()}`;
  };
  const resetHref = tab === 'sensitive' ? '/admin/audit?tab=sensitive' : '/admin/audit';
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Data &amp; permissions audit</h1>
      <section aria-label="Audit log" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <PillNav
            label="Audit views"
            active={resetHref}
            items={[
              { href: '/admin/audit', label: 'Actions', icon: History },
              { href: '/admin/audit?tab=sensitive', label: 'Sensitive access', icon: Eye },
            ]}
          />
          <span className="text-xs text-slate-500 tabular-nums">{total.toLocaleString('en-IN')} entr{total === 1 ? 'y' : 'ies'} · IST</span>
          <span className="flex-1" />
          {tab === 'actions' ? (
            exportEnabled ? (
              <Button asChild variant="outline" size="sm" className="h-8">
                <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/audit/export?${qs.toString()}`}>
                  <Download />
                  Export CSV (audited)
                </a>
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                Export disabled (audit.exportEnabled)
              </span>
            )
          ) : null}
        </div>
        <Form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3" action="/admin/audit">
          {tab === 'sensitive' ? <input type="hidden" name="tab" value="sensitive" /> : null}
          {tab === 'actions' ? (
            <>
              <select aria-label="Category" className={cn(selectClass, 'h-9 min-w-36 flex-[1_1_9rem]')} name="group" defaultValue={sp.group ?? ''}>
                <option value="">All categories</option>
                {cat.groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
              <select aria-label="Action" className={cn(selectClass, 'h-9 min-w-44 flex-[1_1_11rem]')} name="action" defaultValue={sp.action ?? ''}>
                <option value="">Any action</option>
                {cat.groups.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {g.actions.map((a) => (
                      <option key={a.action} value={a.action}>
                        {a.action} ({a.count})
                      </option>
                    ))}
                  </optgroup>
                ))}
                {cat.other.length ? (
                  <optgroup label="Other">
                    {cat.other.map((a) => (
                      <option key={a.action} value={a.action}>
                        {a.action} ({a.count})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </>
          ) : null}
          <select aria-label="Actor" className={cn(selectClass, 'h-9 min-w-40 flex-[1_1_10rem]')} name="actorUserId" defaultValue={sp.actorUserId ?? ''}>
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.role.toLowerCase()})
              </option>
            ))}
          </select>
          <select aria-label="Entity type" className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')} name="entityType" defaultValue={sp.entityType ?? ''}>
            <option value="">Any entity</option>
            {cat.entityTypes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <input aria-label="From date" className={cn(selectClass, 'h-9 w-36')} type="date" name="from" defaultValue={sp.from ?? ''} />
          <input aria-label="To date" className={cn(selectClass, 'h-9 w-36')} type="date" name="to" defaultValue={sp.to ?? ''} />
          <Button type="submit" size="sm" className="h-9">
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={resetHref}>Reset</Link>
          </Button>
        </Form>
        <div className="min-h-0 flex-1">
          {tab === 'actions' ? (
            <AuditActionsTable rows={list.data as AuditRow[]} sp={sp} />
          ) : (
            <SensitiveAccessTable rows={list.data as SensitiveRow[]} />
          )}
        </div>
        <DataTablePagination page={page} pageSize={50} total={total} href={(p) => link({ page: String(p) })} noun="entries" />
      </section>
    </div>
  );
}
