'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
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
type Area = WebArea;

/**
 * F-701 web notification drawer: unread badge (polled), latest items, mark all read. Opening an item asks the API to
 * re-check that the target is still visible (ownership may have changed) before navigating.
 */
export function NotificationBell({ area }: { area: Area }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      setUnread((await clientApi.get<{ unread: number }>('/notifications/unread-count')).data.unread);
    } catch {
      /* badge is best-effort */
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void poll(), 0);
    const t = setInterval(() => void poll(), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [poll]);

  const open = async () => {
    ref.current?.showModal();
    setMsg(null);
    try {
      setRows((await clientApi.get<Row[]>('/notifications?pageSize=30')).data);
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Could not load notifications.');
    }
  };
  const follow = async (n: Row) => {
    try {
      const t = (await clientApi.get<{ entityType: string | null; entityId: string | null; targetRole?: string | null }>(`/notifications/${n.id}/target`)).data;
      setRows((r) => r?.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)) ?? r);
      void poll();
      const href = t.entityType && t.entityId ? notificationHref(area, t.entityType, t.entityId, t.targetRole) : null;
      if (href) {
        ref.current?.close();
        router.push(href);
      }
    } catch (e) {
      setMsg(e instanceof ApiClientError && e.status === 404 ? 'You no longer have access to this item.' : 'Could not open this item.');
    }
  };
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative" onClick={() => void open()}>
        <Bell />
        {unread ? <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-rose-600 px-1 text-[10px] leading-5 font-semibold text-white">{unread > 99 ? '99+' : unread}</span> : null}
      </Button>
      <dialog ref={ref} aria-label="Notifications" className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-white p-0 shadow-2xl backdrop:bg-slate-900/40" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="grid">
            <h2 className="font-semibold">Notifications</h2>
            <a href={`/${area}/notifications`} className="text-xs text-teal-800 hover:underline">
              View all
            </a>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={!unread}
              onClick={async () => {
                await clientApi.post('/notifications/read-all', {});
                setRows((r) => r?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? r);
                setUnread(0);
              }}
            >
              Mark all read
            </Button>
            <Button size="sm" variant="ghost" onClick={() => ref.current?.close()} aria-label="Close notifications">
              Close
            </Button>
          </div>
        </div>
        {msg ? (
          <p role="alert" className="text-destructive px-4 pt-3 text-sm">
            {msg}
          </p>
        ) : null}
        <ul className="divide-y overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 60px)' }}>
          {rows === null ? <li className="text-muted-foreground p-4 text-sm">Loading…</li> : null}
          {rows?.length === 0 ? <li className="text-muted-foreground p-4 text-sm">No notifications yet.</li> : null}
          {rows?.map((n) => (
            <li key={n.id}>
              <button type="button" className={`grid w-full gap-0.5 px-4 py-3 text-left hover:bg-slate-50 ${n.readAt ? '' : 'bg-teal-50/60'}`} onClick={() => void follow(n)}>
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {n.title}
                  {n.readAt ? null : <span className="size-2 shrink-0 rounded-full bg-teal-600" aria-label="unread" />}
                </span>
                <span className="text-muted-foreground text-xs break-words">{n.body}</span>
                <span className="text-muted-foreground text-[11px]">{formatDateTime(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
