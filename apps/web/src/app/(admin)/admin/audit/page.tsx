import { formatDateTime } from '@kbs/shared';
import { ArrowRight, Bot, ChevronLeft, ChevronRight, Download, Eye, History, Lock } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, PillNav, selectClass } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Audit · KBS Solutions' };

interface Actor {
  id: string;
  fullName: string;
  role: string;
  publicRef: string;
}
interface AuditRow {
  id: string;
  at: string;
  action: string;
  actor: Actor | null;
  actorRole: string | null;
  entityType: string | null;
  entityId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  requestId: string | null;
}
interface SensitiveRow {
  id: string;
  at: string;
  actor: Actor | null;
  entityType: string;
  entityId: string;
  field: string;
  purpose: string | null;
}
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
/** Before/after shown side by side only for the fields that changed (F-704 detail). */
function Diff({ before, after }: { before: unknown; after: unknown }) {
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : v === null || v === undefined ? {} : { value: v });
  const b = obj(before);
  const a = obj(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort().filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  if (!keys.length) return <p className="text-xs text-slate-500">No field-level change recorded.</p>;
  return (
    <dl className="grid gap-2">
      {keys.map((k) => (
        <div key={k} className="grid gap-1.5 rounded-lg border border-slate-200/80 bg-white p-2">
          <dt className="font-mono text-[11px] font-semibold text-slate-600">{k}</dt>
          <dd className="grid items-start gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="min-w-0 rounded-md bg-rose-50 px-2 py-1 ring-1 ring-rose-100 ring-inset">
              <div className="text-[9.5px] font-semibold tracking-wider text-rose-500 uppercase">Before</div>
              <div className="font-mono break-all text-rose-800">{b[k] === undefined ? '—' : JSON.stringify(b[k])}</div>
            </div>
            <ArrowRight className="hidden size-3.5 self-center text-slate-400 sm:block" aria-hidden="true" />
            <div className="min-w-0 rounded-md bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100 ring-inset">
              <div className="text-[9.5px] font-semibold tracking-wider text-emerald-600 uppercase">After</div>
              <div className="font-mono break-all text-emerald-900">{a[k] === undefined ? '—' : JSON.stringify(a[k])}</div>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Actor cell: avatar + name + role; system events get a neutral icon. */
function ActorCell({ actor, role }: { actor: Actor | null; role: string | null | undefined }) {
  return (
    <div className="flex min-w-32 items-center gap-2">
      {actor ? (
        <Avatar name={actor.fullName} size="sm" />
      ) : (
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">
          <Bot className="size-3.5" />
        </span>
      )}
      <div className="min-w-0 text-xs">
        <div className="font-medium text-slate-800">{actor ? actor.fullName : 'system'}</div>
        {role ? <div className="text-slate-500">{humanize(role)}</div> : null}
      </div>
    </div>
  );
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
  const pages = Math.max(1, Math.ceil(total / 50));
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Data &amp; permissions audit</h1>
      <section aria-label="Audit log" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
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
          {list.data.length === 0 ? (
            <EmptyState icon={tab === 'actions' ? History : Eye} className="m-3" title={tab === 'actions' ? 'No audit entries match.' : 'No sensitive access recorded.'} />
          ) : tab === 'actions' ? (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="pr-4">Reason / change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data as AuditRow[]).map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell data-label="When" className="pl-4 text-xs whitespace-nowrap text-slate-600 tabular-nums">
                      {formatDateTime(r.at)}
                    </TableCell>
                    <TableCell data-label="Action">
                      <Link className="inline-block rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[11.5px] break-all ring-1 ring-indigo-100 ring-inset" href={link({ action: r.action, group: undefined, page: undefined })}>
                        {r.action}
                      </Link>
                    </TableCell>
                    <TableCell data-label="Actor">
                      <ActorCell actor={r.actor} role={r.actorRole} />
                    </TableCell>
                    <TableCell data-label="Entity" className="text-xs">
                      <span className="font-medium text-slate-700">{r.entityType ?? '—'}</span>
                      <div className="font-mono text-[11px] break-all text-slate-500">{r.entityId ?? ''}</div>
                    </TableCell>
                    <TableCell data-label="Reason / change" className="min-w-56 pr-4 text-xs whitespace-normal">
                      {r.reason ? <div className="text-slate-700">{r.reason}</div> : null}
                      {r.before !== null || r.after !== null ? (
                        <details className="group mt-1">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-teal-700 hover:text-teal-900 [&::-webkit-details-marker]:hidden">
                            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
                            Before / after
                          </summary>
                          <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-50 p-2">
                            <Diff before={r.before} after={r.after} />
                          </div>
                        </details>
                      ) : null}
                      {!r.reason && r.before === null && r.after === null ? <span className="text-slate-400">—</span> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Revealed</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="pr-4">Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data as SensitiveRow[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell data-label="When" className="pl-4 text-xs whitespace-nowrap text-slate-600 tabular-nums">
                      {formatDateTime(r.at)}
                    </TableCell>
                    <TableCell data-label="Actor">
                      {r.actor ? <ActorCell actor={r.actor} role={r.actor.role} /> : '—'}
                    </TableCell>
                    <TableCell data-label="Revealed">
                      <Badge variant="warning">{r.field.replace(/_/g, ' ').toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell data-label="Entity" className="text-xs">
                      <span className="font-medium text-slate-700">{r.entityType}</span>
                      <div className="font-mono text-[11px] break-all text-slate-500">{r.entityId}</div>
                    </TableCell>
                    <TableCell data-label="Purpose" className="pr-4 text-xs text-slate-600">
                      {(r.purpose ?? '—').replace(/_/g, ' ').toLowerCase()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-500 tabular-nums">
            {total ? `${((page - 1) * 50 + 1).toLocaleString('en-IN')}–${Math.min(page * 50, total).toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}` : '0 entries'} · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page - 1) })}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={link({ page: String(page + 1) })}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
