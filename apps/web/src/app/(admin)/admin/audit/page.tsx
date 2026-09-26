import { formatDateTime } from '@kbs/shared';
import { ArrowRight, Bot, ChevronLeft, ChevronRight, Download, Eye, Filter, History, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { AdminDashboardNav } from '@/components/admin-dashboard-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, Field, humanize, PageHeader, PillNav, SectionCard, selectClass } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

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

/** F-704 data & permissions audit dashboard (REQ-16 §16.2, REQ-24 §24.3). Read-only; export follows audit.exportEnabled. */
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
    <div className="grid gap-6">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Dashboards"
        tone="indigo"
        title="Data & permissions audit"
        description="Every accepted or rejected upload, mapping revision, lead reference linkage, bank status change, assignment/WFH grant, training reactivation, payout decision and manual payment with actor, time and source. Read-only."
      />
      <AdminDashboardNav active="/admin/audit" />
      <div className="grid gap-3">
        <PillNav
          label="Audit views"
          active={resetHref}
          items={[
            { href: '/admin/audit', label: 'Actions', icon: History },
            { href: '/admin/audit?tab=sensitive', label: 'Sensitive access', icon: Eye },
          ]}
        />
        <form className="grid grid-cols-2 items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)] lg:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]" action="/admin/audit">
          {tab === 'sensitive' ? <input type="hidden" name="tab" value="sensitive" /> : null}
          {tab === 'actions' ? (
            <>
              <Field label="Category" htmlFor="audit-group">
                <select id="audit-group" className={selectClass} name="group" defaultValue={sp.group ?? ''}>
                  <option value="">All categories</option>
                  {cat.groups.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Action" htmlFor="audit-action">
                <select id="audit-action" className={selectClass} name="action" defaultValue={sp.action ?? ''}>
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
              </Field>
            </>
          ) : null}
          <Field label="Actor" htmlFor="audit-actor">
            <select id="audit-actor" className={selectClass} name="actorUserId" defaultValue={sp.actorUserId ?? ''}>
              <option value="">Anyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role.toLowerCase()})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Entity type" htmlFor="audit-entity">
            <select id="audit-entity" className={selectClass} name="entityType" defaultValue={sp.entityType ?? ''}>
              <option value="">Any</option>
              {cat.entityTypes.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From" htmlFor="audit-from">
            <input id="audit-from" className={selectClass} type="date" name="from" defaultValue={sp.from ?? ''} />
          </Field>
          <Field label="To" htmlFor="audit-to">
            <input id="audit-to" className={selectClass} type="date" name="to" defaultValue={sp.to ?? ''} />
          </Field>
          <div className="col-span-2 flex gap-2 lg:col-span-1">
            <Button type="submit" className="h-10">
              <Filter />
              Apply
            </Button>
            <Button asChild variant="outline" className="h-10">
              <Link href={resetHref}>Reset</Link>
            </Button>
          </div>
        </form>
      </div>
      <SectionCard
        icon={tab === 'actions' ? History : Eye}
        tone={tab === 'actions' ? 'indigo' : 'amber'}
        title={`${total} entr${total === 1 ? 'y' : 'ies'}`}
        description="Newest first · times in IST. Personal data is masked in the log; open the record for context."
        flush={list.data.length > 0}
        actions={
          tab === 'actions' ? (
            exportEnabled ? (
              <Button asChild variant="outline" size="sm">
                <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/audit/export?${qs.toString()}`}>
                  <Download />
                  Export CSV (audited)
                </a>
              </Button>
            ) : (
              <span className="inline-flex max-w-xs items-start gap-1.5 text-xs text-slate-500">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Export disabled — KBS has not approved an export policy (audit.exportEnabled).
              </span>
            )
          ) : null
        }
      >
        {list.data.length === 0 ? (
          <EmptyState icon={tab === 'actions' ? History : Eye} title={tab === 'actions' ? 'No audit entries match.' : 'No sensitive access recorded.'} />
        ) : tab === 'actions' ? (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Reason / change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data as AuditRow[]).map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600 tabular-nums">
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
                  <TableCell data-label="Reason / change" className="min-w-56 text-xs whitespace-normal">
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
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Revealed</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data as SensitiveRow[]).map((r) => (
                <TableRow key={r.id}>
                  <TableCell data-label="When" className="text-xs whitespace-nowrap text-slate-600 tabular-nums">
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
                  <TableCell data-label="Purpose" className="text-xs text-slate-600">
                    {(r.purpose ?? '—').replace(/_/g, ' ').toLowerCase()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className={cn('flex flex-wrap items-center justify-between gap-2 text-sm', list.data.length > 0 ? 'border-t border-slate-100 px-5 py-3 sm:px-6' : 'mt-4')}>
          <span className="text-slate-500 tabular-nums">
            Page {page} of {Math.max(1, Math.ceil(total / 50))}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={link({ page: String(page - 1) })}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : null}
            {page * 50 < total ? (
              <Button asChild size="sm" variant="outline">
                <Link href={link({ page: String(page + 1) })}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
