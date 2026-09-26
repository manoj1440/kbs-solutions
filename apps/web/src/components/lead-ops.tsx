'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { Check, ClipboardList, ListTodo, MessageSquare, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, Field, SectionCard } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

export interface FollowUpDto {
  id: string;
  text: string;
  dueAt: string;
  doneAt: string | null;
  owner: { id: string; fullName: string };
}
export interface RemarkDto {
  id: string;
  text: string;
  at: string;
  editedAt: string | null;
  author: { id: string; fullName: string };
}

/**
 * F-409 — follow-up tasks (labelled "Follow-up task", owner + due date) and dated operational remarks on a lead.
 * Both are KBS activity; they never touch bank status or bank remarks (REQ-14 §14.5).
 */
export function LeadOps({ leadId, followUps, remarks }: { leadId: string; followUps: FollowUpDto[]; remarks: RemarkDto[] }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [remark, setRemark] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard icon={ClipboardList} tone="sky" title="Follow-up tasks & operational remarks" description="KBS activity only. Bank remarks live in section C and cannot be edited here." bodyClassName="grid gap-6 md:grid-cols-2">
      <div className="grid content-start gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <ListTodo className="size-4 text-amber-600" aria-hidden="true" />
          Follow-up tasks
          <span className="rounded-full bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-600 tabular-nums">{followUps.length}</span>
        </p>
        {followUps.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-sm text-slate-500">No follow-up tasks.</p> : null}
        {followUps.length ? (
          <ol className="grid">
            {followUps.map((t) => (
              <li key={t.id} className="relative grid gap-1.5 pb-4 pl-6 last:pb-0 before:absolute before:top-2 before:bottom-0 before:left-[5px] before:w-px before:bg-slate-200 last:before:hidden">
                <span className={`absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-white ring-1 ${t.doneAt ? 'bg-emerald-500 ring-emerald-200' : 'bg-amber-500 ring-amber-200'}`} aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={t.doneAt ? 'secondary' : 'warning'}>Follow-up task</Badge>
                  <span className={t.doneAt ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800'}>{t.text}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {t.owner.fullName} · due {formatDateTime(t.dueAt)}
                    {t.doneAt ? ` · done ${formatDateTime(t.doneAt)}` : ''}
                  </span>
                  {!t.doneAt ? (
                    <Button size="sm" variant="soft" className="h-7" disabled={busy} onClick={() => void run(() => clientApi.post(`/follow-ups/${t.id}/done`, {}), 'Task marked done.')}>
                      <Check aria-hidden="true" />
                      Mark done
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        <form
          className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => clientApi.post(`/leads/${leadId}/follow-ups`, { text, dueAt: new Date(dueAt).toISOString() }), 'Follow-up task created.').then(() => {
              setText('');
              setDueAt('');
            });
          }}
        >
          <Field label="New follow-up task" htmlFor="fu-text">
            <Input id="fu-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs to be done" required minLength={3} className="bg-white" />
          </Field>
          <Field label="Due" htmlFor="fu-due">
            <Input id="fu-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required className="bg-white" />
          </Field>
          <Button type="submit" size="sm" className="justify-self-start" disabled={busy || !text.trim() || !dueAt}>
            <Plus aria-hidden="true" />
            Add follow-up task
          </Button>
        </form>
      </div>
      <div className="grid content-start gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <MessageSquare className="size-4 text-sky-600" aria-hidden="true" />
          Operational remarks
          <span className="rounded-full bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-600 tabular-nums">{remarks.length}</span>
        </p>
        {remarks.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-sm text-slate-500">No operational remarks.</p> : null}
        {remarks.length ? (
          <ol className="grid gap-3">
            {remarks.map((r) => (
              <li key={r.id} className="flex gap-3 text-sm">
                <Avatar name={r.author.fullName} size="sm" />
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-slate-200/80 bg-slate-50/60 px-3 py-2">
                  <p className="break-words text-slate-800">{r.text}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.author.fullName} · {formatDateTime(r.at)}
                    {r.editedAt ? ' · edited' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        <form
          className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => clientApi.post(`/leads/${leadId}/remarks`, { text: remark }), 'Remark added.').then(() => setRemark(''));
          }}
        >
          <Field label="Add remark" htmlFor="rm-text">
            <Input id="rm-text" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Dated note with your name attached" required className="bg-white" />
          </Field>
          <Button type="submit" size="sm" variant="outline" className="justify-self-start" disabled={busy || !remark.trim()}>
            <MessageSquare aria-hidden="true" />
            Add remark
          </Button>
        </form>
      </div>
      {msg ? (
        <p role="status" className="text-sm md:col-span-2">
          {msg}
        </p>
      ) : null}
    </SectionCard>
  );
}
