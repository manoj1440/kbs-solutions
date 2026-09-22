'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <Card>
      <CardHeader>
        <CardTitle>Follow-up tasks & operational remarks</CardTitle>
        <CardDescription>KBS activity only. Bank remarks live in section C and cannot be edited here.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <p className="text-sm font-medium">Follow-up tasks</p>
          {followUps.length === 0 ? <p className="text-muted-foreground text-sm">No follow-up tasks.</p> : null}
          {followUps.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={t.doneAt ? 'secondary' : 'warning'}>Follow-up task</Badge>
              <span>{t.text}</span>
              <span className="text-muted-foreground text-xs">
                {t.owner.fullName} · due {formatDateTime(t.dueAt)}
                {t.doneAt ? ` · done ${formatDateTime(t.doneAt)}` : ''}
              </span>
              {!t.doneAt ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => clientApi.post(`/follow-ups/${t.id}/done`, {}), 'Task marked done.')}>
                  Mark done
                </Button>
              ) : null}
            </div>
          ))}
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => clientApi.post(`/leads/${leadId}/follow-ups`, { text, dueAt: new Date(dueAt).toISOString() }), 'Follow-up task created.').then(() => {
                setText('');
                setDueAt('');
              });
            }}
          >
            <Label htmlFor="fu-text">New follow-up task</Label>
            <Input id="fu-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs to be done" required minLength={3} />
            <Label htmlFor="fu-due">Due</Label>
            <Input id="fu-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
            <Button type="submit" size="sm" disabled={busy || !text.trim() || !dueAt}>
              Add follow-up task
            </Button>
          </form>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Operational remarks</p>
          {remarks.length === 0 ? <p className="text-muted-foreground text-sm">No operational remarks.</p> : null}
          {remarks.map((r) => (
            <div key={r.id} className="text-sm">
              <p>{r.text}</p>
              <p className="text-muted-foreground text-xs">
                {r.author.fullName} · {formatDateTime(r.at)}
                {r.editedAt ? ' · edited' : ''}
              </p>
            </div>
          ))}
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => clientApi.post(`/leads/${leadId}/remarks`, { text: remark }), 'Remark added.').then(() => setRemark(''));
            }}
          >
            <Label htmlFor="rm-text">Add remark</Label>
            <Input id="rm-text" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Dated note with your name attached" required />
            <Button type="submit" size="sm" variant="outline" disabled={busy || !remark.trim()}>
              Add remark
            </Button>
          </form>
        </div>
        {msg ? (
          <p role="status" className="text-sm md:col-span-2">
            {msg}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
