'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clientApi } from '@/lib/client-api';
import { notificationHref, type WebArea } from '@/lib/notification-links';

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
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-muted-foreground text-sm">{unread === null ? 'Loading…' : `${unread} unread.`} Opening an item checks that you can still see the record.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={unreadOnly ? 'outline' : 'default'} aria-pressed={!unreadOnly} onClick={() => (setUnreadOnly(false), setPage(1))}>
            All
          </Button>
          <Button size="sm" variant={unreadOnly ? 'default' : 'outline'} aria-pressed={unreadOnly} onClick={() => (setUnreadOnly(true), setPage(1))}>
            Unread
          </Button>
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
            Mark all read
          </Button>
        </div>
      </div>
      {msg ? (
        <p role="status" className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{unreadOnly ? 'Unread' : 'All notifications'}</CardTitle>
          <CardDescription>
            {total} item{total === 1 ? '' : 's'} · newest first · times in IST
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {rows === null ? <li className="text-muted-foreground p-4 text-sm">Loading…</li> : null}
            {rows?.length === 0 && !msg ? <li className="text-muted-foreground p-4 text-sm">{unreadOnly ? 'Nothing unread.' : 'No notifications yet.'}</li> : null}
            {rows?.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => void open(n)} className={`grid w-full gap-1 px-4 py-3 text-left hover:bg-slate-50 sm:px-6 ${n.readAt ? '' : 'bg-teal-50/60'}`}>
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {n.title}
                    {n.readAt ? null : <Badge variant="info">Unread</Badge>}
                  </span>
                  <span className="text-muted-foreground text-sm break-words">{n.body}</span>
                  <span className="text-muted-foreground text-xs">{formatDateTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
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
