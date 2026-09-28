'use client';

import { formatDateTime } from '@kbs/shared';
import { ArrowRight, Bot, ChevronRight, Eye, History } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, humanize } from '@/components/ui/kit';

export interface Actor {
  id: string;
  fullName: string;
  role: string;
  publicRef: string;
}
export interface AuditRow {
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
export interface SensitiveRow {
  id: string;
  at: string;
  actor: Actor | null;
  entityType: string;
  entityId: string;
  field: string;
  purpose: string | null;
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

const a = columnHelper<AuditRow>();
const s = columnHelper<SensitiveRow>();

export function AuditActionsTable({ rows, sp }: { rows: AuditRow[]; sp: Record<string, string | undefined> }) {
  /** Same link() as the page: keep current filters, override action, drop group/page. */
  const actionHref = (action: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, action, group: undefined, page: undefined })) if (v) q.set(k, v);
    return `/admin/audit?${q.toString()}`;
  };
  const columns = a.columns([
    a.accessor('at', {
      header: 'When',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs whitespace-nowrap text-slate-600 tabular-nums' },
      cell: ({ getValue }) => formatDateTime(getValue()),
    }),
    a.accessor('action', {
      header: 'Action',
      cell: ({ getValue }) => (
        <Link className="inline-block rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[11.5px] break-all ring-1 ring-indigo-100 ring-inset" href={actionHref(getValue())}>
          {getValue()}
        </Link>
      ),
    }),
    a.accessor((r) => r.actor?.fullName ?? 'system', {
      id: 'actor',
      header: 'Actor',
      cell: ({ row }) => <ActorCell actor={row.original.actor} role={row.original.actorRole} />,
    }),
    a.accessor((r) => r.entityType ?? '', {
      id: 'entity',
      header: 'Entity',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <span className="font-medium text-slate-700">{row.original.entityType ?? '—'}</span>
          <div className="font-mono text-[11px] break-all text-slate-500">{row.original.entityId ?? ''}</div>
        </>
      ),
    }),
    a.display({
      id: 'change',
      header: 'Reason / change',
      meta: { cellClassName: 'min-w-56 text-xs whitespace-normal' },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <>
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
          </>
        );
      },
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      viewOptions
      pagedOnServer
      getRowProps={() => ({ className: 'align-top' })}
      empty={<EmptyState icon={History} className="m-3" title="No audit entries match." />}
    />
  );
}

export function SensitiveAccessTable({ rows }: { rows: SensitiveRow[] }) {
  const columns = s.columns([
    s.accessor('at', {
      header: 'When',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs whitespace-nowrap text-slate-600 tabular-nums' },
      cell: ({ getValue }) => formatDateTime(getValue()),
    }),
    s.accessor((r) => r.actor?.fullName ?? '—', {
      id: 'actor',
      header: 'Actor',
      cell: ({ row }) => (row.original.actor ? <ActorCell actor={row.original.actor} role={row.original.actor.role} /> : '—'),
    }),
    s.accessor('field', {
      header: 'Revealed',
      cell: ({ getValue }) => <Badge variant="warning">{getValue().replace(/_/g, ' ').toLowerCase()}</Badge>,
    }),
    s.accessor('entityType', {
      header: 'Entity',
      meta: { cellClassName: 'text-xs' },
      cell: ({ row }) => (
        <>
          <span className="font-medium text-slate-700">{row.original.entityType}</span>
          <div className="font-mono text-[11px] break-all text-slate-500">{row.original.entityId}</div>
        </>
      ),
    }),
    s.accessor((r) => r.purpose ?? '', {
      id: 'purpose',
      header: 'Purpose',
      meta: { cellClassName: 'text-xs text-slate-600' },
      cell: ({ row }) => (row.original.purpose ?? '—').replace(/_/g, ' ').toLowerCase(),
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      pagedOnServer
      empty={<EmptyState icon={Eye} className="m-3" title="No sensitive access recorded." />}
    />
  );
}
