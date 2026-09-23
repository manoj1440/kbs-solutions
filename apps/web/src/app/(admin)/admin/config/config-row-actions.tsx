'use client';

import { ApiClientError, type ConfigEntry, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

interface HistoryRow {
  id: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  at: string;
  changedBy: { fullName: string | null; role: string; publicRef: string } | null;
}

const show = (v: unknown) => (v === null || v === undefined ? 'unset' : JSON.stringify(v));

function initialText(entry: ConfigEntry) {
  if (entry.value === null || entry.value === undefined) return '';
  return entry.valueType === 'JSON' ? JSON.stringify(entry.value, null, 2) : String(entry.value);
}

/** Parse the editor text into the key's type. Empty = unset (null). */
function parse(
  entry: ConfigEntry,
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = text.trim();
  if (t === '') return { ok: true, value: null };
  switch (entry.valueType) {
    case 'INT':
    case 'DURATION':
      return /^-?\d+$/.test(t)
        ? { ok: true, value: Number(t) }
        : { ok: false, error: 'Enter a whole number.' };
    case 'BOOL':
      return t === 'true' || t === 'false'
        ? { ok: true, value: t === 'true' }
        : { ok: false, error: 'Choose true or false.' };
    case 'JSON':
      try {
        return { ok: true, value: JSON.parse(t) };
      } catch {
        return { ok: false, error: 'Not valid JSON.' };
      }
    default:
      return { ok: true, value: t };
  }
}

/** F-104: edit a config value with a mandatory reason (audited, history row) and view its change history. */
export function ConfigRowActions({ entry }: { entry: ConfigEntry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialText(entry));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);

  const save = async () => {
    const parsed = parse(entry, text);
    if (!parsed.ok) return setErr(parsed.error);
    setBusy(true);
    setErr(null);
    try {
      await clientApi.put(`/config/${encodeURIComponent(entry.key)}`, {
        value: parsed.value,
        reason: reason.trim(),
      });
      setEditing(false);
      setReason('');
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async () => {
    drawer.current?.showModal();
    setHistory(null);
    try {
      setHistory(
        (await clientApi.get<HistoryRow[]>(`/config/${encodeURIComponent(entry.key)}/history`))
          .data,
      );
    } catch {
      setHistory([]);
    }
  };

  return (
    <div className="grid gap-1">
      {editing ? (
        <div className="grid min-w-64 gap-1">
          {entry.valueType === 'BOOL' ? (
            <select
              aria-label={`New value for ${entry.key}`}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            >
              <option value="">unset</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : entry.valueType === 'JSON' ? (
            <textarea
              aria-label={`New value for ${entry.key}`}
              className="border-input bg-background min-h-24 rounded-md border p-2 font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <Input
              aria-label={`New value for ${entry.key}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Empty = unset"
              inputMode={
                entry.valueType === 'INT' || entry.valueType === 'DURATION' ? 'numeric' : undefined
              }
              className="font-mono text-xs"
            />
          )}
          <Input
            aria-label="Reason for change"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
          />
          <div className="flex gap-1">
            <Button size="sm" disabled={busy || reason.trim().length < 3} onClick={save}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setErr(null);
                setText(initialText(entry));
              }}
            >
              Cancel
            </Button>
          </div>
          {err ? <span className="text-destructive text-xs">{err}</span> : null}
        </div>
      ) : (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={openHistory}>
            History
          </Button>
        </div>
      )}
      <dialog
        ref={drawer}
        aria-label={`History of ${entry.key}`}
        className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
        onClick={(e) => e.target === drawer.current && drawer.current?.close()}
      >
        <div className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Change history</h2>
              <p className="text-muted-foreground font-mono text-xs break-all">{entry.key}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => drawer.current?.close()}>
              Close
            </Button>
          </div>
          {history === null ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Never changed — the default is in effect ({show(entry.defaultValue)}).
            </p>
          ) : (
            <ol className="grid gap-3">
              {history.map((h) => (
                <li key={h.id} className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground text-xs">
                    {`${formatDateTime(h.at)} · ${h.changedBy?.fullName ?? h.changedBy?.publicRef ?? 'unknown'} (${h.changedBy?.role ?? '—'})`}
                  </div>
                  <div className="mt-1 font-mono text-xs break-all">
                    {show(h.oldValue)} → {show(h.newValue)}
                  </div>
                  <div className="mt-1">{h.reason}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </dialog>
    </div>
  );
}
