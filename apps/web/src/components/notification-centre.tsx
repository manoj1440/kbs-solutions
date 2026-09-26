'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Inbox,
  ListChecks,
  type LucideIcon,
  Megaphone,
  Mic,
  Phone,
  ShieldAlert,
  UserRound,
  Wallet,
  Wifi,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, IconTile, PageHeader, SectionCard, type Tone } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';
import { notificationHref, type WebArea } from '@/lib/notification-links';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  deepLink: { entityType: string; entityId: string } | null;
}
const PAGE = 20;

/** F-806: icon + tone per notification, by what it is about (kind first, then the linked entity). */
function look(n: Row): { icon: LucideIcon; tone: Tone } {
  const k = n.kind;
  if (k.startsWith('PAYOUT_')) return { icon: Wallet, tone: k === 'PAYOUT_EXCEPTION' ? 'rose' : 'emerald' };
  if (k.startsWith('MIS_')) return { icon: FileSpreadsheet, tone: 'indigo' };
  if (k.startsWith('ONBOARDING_')) return { icon: ClipboardCheck, tone: 'violet' };
  if (k.startsWith('TRAINING_')) return { icon: GraduationCap, tone: 'sky' };
  if (k.startsWith('WFH_')) return { icon: Wifi, tone: 'sky' };
  if (k === 'LEAD_CREATED') return { icon: ListChecks, tone: 'teal' };
  if (k === 'ASSIGNMENT_NEW') return { icon: Phone, tone: 'teal' };
  if (k === 'FOLLOW_UP_DUE') return { icon: CalendarClock, tone: 'amber' };
  if (k === 'RECORDING_STATUS') return { icon: Mic, tone: 'amber' };
  if (k === 'SECURITY_EVENT') return { icon: ShieldAlert, tone: 'rose' };
  if (k === 'ANNOUNCEMENT') return { icon: Megaphone, tone: 'sky' };
  switch (n.deepLink?.entityType) {
    case 'Lead':
      return { icon: ListChecks, tone: 'teal' };
    case 'PayoutRequest':
      return { icon: Wallet, tone: 'emerald' };
    case 'MisImportBatch':
      return { icon: FileSpreadsheet, tone: 'indigo' };
    case 'User':
      return { icon: UserRound, tone: 'violet' };
    default:
      return { icon: Bell, tone: 'slate' };
  }
}

/**
 * F-804: full notification centre for the web roles (REQ-25 §25.1, REQ-19). Paged, All/Unread, mark all read.
 * Opening an item asks the API to re-check access first (ownership may have changed since it was sent).
 */
export function NotificationCentre({ area }: { area: WebArea }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    try {
      const r = await clientApi.get<Row[]>(`/notifications?page=${page}&pageSize=${PAGE}${unreadOnly ? '&unreadOnly=true' : ''}`);
      setRows(r.data);
      setTotal(Number(r.meta.total ?? r.data.length));
      setUnread(Number((r.meta as { unread?: number }).unread ?? 0));
    } catch (e) {
      setRows([]);
      setMsg(e instanceof ApiClientError ? e.message : 'Could not load notifications. Check your connection and try again.');
    }
  }, [page, unreadOnly]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (n: Row) => {
    setMsg(null);
    try {
      const t = (await clientApi.get<{ entityType: string | null; entityId: string | null; targetRole?: string | null }>(`/notifications/${n.id}/target`)).data;
      setRows((r) => r?.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)) ?? r);
      if (!n.readAt) setUnread((u) => (u === null ? u : Math.max(0, u - 1)));
      const href = t.entityType && t.entityId ? notificationHref(area, t.entityType, t.entityId, t.targetRole) : null;
      if (href) router.push(href);
      else setMsg('Marked as read. This notification has no page to open on the web.');
    } catch (e) {
      setMsg(e instanceof ApiClientError && e.status === 404 ? 'You no longer have access to this item.' : 'Could not open this item.');
    }
  };
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const seg = (on: boolean) => cn('h-8 rounded-lg px-3 text-[13px] shadow-none', on ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100');
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        icon={Bell}
        tone="sky"
        eyebrow={area === 'admin' ? 'Administration' : undefined}
        title="Notifications"
        description={`${unread === null ? 'Loading…' : `${unread} unread.`} Opening an item checks that you can still see the record.`}
        actions={
          <>
            <div className="inline-flex gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
              <Button size="sm" variant="ghost" className={seg(!unreadOnly)} aria-pressed={!unreadOnly} onClick={() => (setUnreadOnly(false), setPage(1))}>
                All
              </Button>
              <Button size="sm" variant="ghost" className={seg(unreadOnly)} aria-pressed={unreadOnly} onClick={() => (setUnreadOnly(true), setPage(1))}>
                Unread
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!unread}
              onClick={async () => {
                try {
                  await clientApi.post('/notifications/read-all', {});
                  await load();
                } catch {
                  setMsg('Could not mark notifications as read.');
                }
              }}
            >
              <CheckCheck />
              Mark all read
            </Button>
          </>
        }
      />
      {msg ? (
        <Callout tone="neutral" role="status">
          {msg}
        </Callout>
      ) : null}
      <SectionCard
        icon={Inbox}
        tone="sky"
        title={unreadOnly ? 'Unread' : 'All notifications'}
        description={`${total} item${total === 1 ? '' : 's'} · newest first · times in IST`}
        flush
      >
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {rows === null
            ? [0, 1, 2].map((i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-4 sm:px-6" aria-hidden={i > 0 || undefined}>
                  <span className="size-8 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                  <span className="grid flex-1 gap-2">
                    {i === 0 ? <span className="text-sm text-slate-500">Loading…</span> : <span className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />}
                    <span className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                  </span>
                </li>
              ))
            : null}
          {rows?.length === 0 && !msg ? (
            <li className="p-5 sm:p-6">
              <EmptyState icon={unreadOnly ? CheckCheck : BellOff} title={unreadOnly ? 'Nothing unread.' : 'No notifications yet.'} />
            </li>
          ) : null}
          {rows?.map((n) => {
            const { icon, tone } = look(n);
            return (
              <li key={n.id} className="relative">
                {n.readAt ? null : <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-teal-600" />}
                <button
                  type="button"
                  onClick={() => void open(n)}
                  className={cn(
                    'group flex w-full min-w-0 items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 sm:px-6',
                    n.readAt ? '' : 'bg-teal-50/50',
                  )}
                >
                  <IconTile icon={icon} tone={tone} size="sm" className={cn(n.readAt && 'opacity-70')} />
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className={cn('flex flex-wrap items-center gap-2 text-sm', n.readAt ? 'font-medium text-slate-700' : 'font-semibold text-slate-900')}>
                      {n.title}
                      {n.readAt ? null : <Badge variant="info">Unread</Badge>}
                    </span>
                    <span className="text-sm break-words text-slate-600">{n.body}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{formatDateTime(n.createdAt)}</span>
                  </span>
                  <ChevronRight className="mt-2 size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </SectionCard>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-slate-500 tabular-nums">
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
