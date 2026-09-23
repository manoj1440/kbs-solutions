import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { AdminDashboardNav } from '@/components/admin-dashboard-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

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
const sel = 'border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm';

/** Before/after shown side by side only for the fields that changed (F-704 detail). */
function Diff({ before, after }: { before: unknown; after: unknown }) {
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : v === null || v === undefined ? {} : { value: v });
  const b = obj(before);
  const a = obj(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort().filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  if (!keys.length) return <p className="text-muted-foreground text-xs">No field-level change recorded.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground text-left">
          <th className="pr-2 font-medium">Field</th>
          <th className="pr-2 font-medium">Before</th>
          <th className="font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="align-top">
            <td className="pr-2 font-mono">{k}</td>
            <td className="pr-2 break-all text-rose-700">{b[k] === undefined ? '—' : JSON.stringify(b[k])}</td>
            <td className="break-all text-teal-800">{a[k] === undefined ? '—' : JSON.stringify(a[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
  return (
    <div className="grid gap-4">
      <AdminDashboardNav active="/admin/audit" />
      <div>
        <h1 className="text-2xl font-semibold">Data & permissions audit</h1>
        <p className="text-muted-foreground text-sm">Every accepted or rejected upload, mapping revision, lead reference linkage, bank status change, assignment/WFH grant, training reactivation, payout decision and manual payment with actor, time and source. Read-only.</p>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button asChild size="sm" variant={tab === 'actions' ? 'default' : 'outline'}>
          <Link href="/admin/audit">Actions</Link>
        </Button>
        <Button asChild size="sm" variant={tab === 'sensitive' ? 'default' : 'outline'}>
          <Link href="/admin/audit?tab=sensitive">Sensitive access</Link>
        </Button>
      </div>
      <form className="grid items-end gap-2 sm:grid-cols-3 lg:grid-cols-6" action="/admin/audit">
        {tab === 'sensitive' ? <input type="hidden" name="tab" value="sensitive" /> : null}
        {tab === 'actions' ? (
          <>
            <label className="grid gap-1 text-xs">
              Category
              <select className={sel} name="group" defaultValue={sp.group ?? ''}>
                <option value="">All categories</option>
                {cat.groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Action
              <select className={sel} name="action" defaultValue={sp.action ?? ''}>
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
            </label>
          </>
        ) : null}
        <label className="grid gap-1 text-xs">
          Actor
          <select className={sel} name="actorUserId" defaultValue={sp.actorUserId ?? ''}>
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.role.toLowerCase()})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Entity type
          <select className={sel} name="entityType" defaultValue={sp.entityType ?? ''}>
            <option value="">Any</option>
            {cat.entityTypes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          From
          <input className={sel} type="date" name="from" defaultValue={sp.from ?? ''} />
        </label>
        <label className="grid gap-1 text-xs">
          To
          <input className={sel} type="date" name="to" defaultValue={sp.to ?? ''} />
        </label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href={tab === 'sensitive' ? '/admin/audit?tab=sensitive' : '/admin/audit'}>Reset</Link>
          </Button>
        </div>
      </form>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{total} entr{total === 1 ? 'y' : 'ies'}</CardTitle>
            <CardDescription>Newest first · times in IST. Personal data is masked in the log; open the record for context.</CardDescription>
          </div>
          {tab === 'actions' ? (
            exportEnabled ? (
              <Button asChild variant="outline" size="sm">
                <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/audit/export?${qs.toString()}`}>Export CSV (audited)</a>
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">Export disabled — KBS has not approved an export policy (audit.exportEnabled).</span>
            )
          ) : null}
        </CardHeader>
        <CardContent>
          {tab === 'actions' ? (
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
                {list.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No audit entries match.
                    </TableCell>
                  </TableRow>
                ) : null}
                {(list.data as AuditRow[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell data-label="When" className="text-xs whitespace-nowrap">
                      {formatDateTime(r.at)}
                    </TableCell>
                    <TableCell data-label="Action">
                      <Link className="font-mono text-xs underline" href={link({ action: r.action, group: undefined, page: undefined })}>
                        {r.action}
                      </Link>
                    </TableCell>
                    <TableCell data-label="Actor" className="text-xs">
                      {r.actor ? r.actor.fullName : 'system'}
                      <div className="text-muted-foreground">{(r.actorRole ?? '').toLowerCase()}</div>
                    </TableCell>
                    <TableCell data-label="Entity" className="text-xs">
                      {r.entityType ?? '—'}
                      <div className="text-muted-foreground font-mono break-all">{r.entityId ?? ''}</div>
                    </TableCell>
                    <TableCell data-label="Reason / change" className="text-xs whitespace-normal">
                      {r.reason ? <div>{r.reason}</div> : null}
                      {r.before !== null || r.after !== null ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-teal-800">Before / after</summary>
                          <div className="mt-1 rounded-md border bg-slate-50 p-2">
                            <Diff before={r.before} after={r.after} />
                          </div>
                        </details>
                      ) : null}
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
                {list.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No sensitive access recorded.
                    </TableCell>
                  </TableRow>
                ) : null}
                {(list.data as SensitiveRow[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell data-label="When" className="text-xs whitespace-nowrap">
                      {formatDateTime(r.at)}
                    </TableCell>
                    <TableCell data-label="Actor" className="text-xs">
                      {r.actor?.fullName ?? '—'} <span className="text-muted-foreground">({(r.actor?.role ?? '').toLowerCase()})</span>
                    </TableCell>
                    <TableCell data-label="Revealed">
                      <Badge variant="warning">{r.field.replace(/_/g, ' ').toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell data-label="Entity" className="text-xs">
                      {r.entityType}
                      <div className="text-muted-foreground font-mono break-all">{r.entityId}</div>
                    </TableCell>
                    <TableCell data-label="Purpose" className="text-xs">
                      {(r.purpose ?? '—').replace(/_/g, ' ').toLowerCase()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(total / 50))}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={link({ page: String(page - 1) })}>Previous</Link>
                </Button>
              ) : null}
              {page * 50 < total ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={link({ page: String(page + 1) })}>Next</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
