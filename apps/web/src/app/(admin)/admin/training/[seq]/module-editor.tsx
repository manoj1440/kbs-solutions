'use client';

import { ApiClientError, type QuestionInput, type TrainingModuleView, ReplaceQuestionsBody, UpdateModuleBody } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

export type ModuleDetail = TrainingModuleView & {
  draftQuestionCount?: number;
  questionsVersion: number;
  questions: Array<{ id: string; sequence: number; text: string; options: Array<{ key: string; text: string }>; correctKey?: string }>;
};

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function ModuleEditor({ initial }: { initial: ModuleDetail }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [material, setMaterial] = useState(initial.materialText ?? '');
  const [threshold, setThreshold] = useState(String(initial.passThresholdPct));
  const [videoFileId, setVideoFileId] = useState(initial.videoFileId);
  const [questions, setQuestions] = useState<QuestionInput[]>(
    initial.questions.map((q) => ({ text: q.text, options: q.options, correctKey: q.correctKey ?? 'A' })),
  );
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'ok', text: `${label} saved.` });
      router.refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiClientError ? e.message : `${label} failed.` });
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = () =>
    run('Details', async () => {
      const body = UpdateModuleBody.parse({ title, materialText: material || null, passThresholdPct: Number(threshold), videoFileId });
      await clientApi.put(`/training/modules/${initial.sequence}`, body);
    });

  const saveQuestions = () =>
    run('Questions', async () => {
      const body = ReplaceQuestionsBody.parse({ questions });
      await clientApi.put(`/training/modules/${initial.sequence}/questions`, body);
    });

  const publish = () =>
    run('Publish', async () => {
      await clientApi.post(`/training/modules/${initial.sequence}/publish`);
    });

  const uploadVideo = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await clientApi.post<{ id: string }>('/files/training_video', fd);
      setVideoFileId(r.data.id);
      setMsg({ kind: 'ok', text: 'Video uploaded — save details to attach it.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiClientError ? e.message : 'Upload failed.' });
    } finally {
      setBusy(false);
    }
  };

  const setQ = (i: number, patch: Partial<QuestionInput>) => setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Module {initial.sequence}</h1>
          <p className="text-muted-foreground text-sm">
            Live version {initial.version} · {initial.questionCount} questions
            {initial.draftVersion ? ` · draft v${initial.draftVersion} (${initial.draftQuestionCount ?? 0} questions) awaiting publish` : ''}
          </p>
        </div>
        <Badge variant={initial.status === 'PUBLISHED' ? 'success' : 'warning'}>{initial.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="threshold">Pass threshold (%)</Label>
            <Input id="threshold" type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-32" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="material">Learning material (optional, markdown)</Label>
            <textarea id="material" className="border-input min-h-32 rounded-md border bg-transparent p-3 text-sm" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="video">Video (mp4/webm)</Label>
            <Input id="video" type="file" accept="video/mp4,video/webm" onChange={(e) => e.target.files?.[0] && void uploadVideo(e.target.files[0])} />
            <p className="text-muted-foreground text-xs">{videoFileId ? `Attached file ${videoFileId}` : 'No video attached'}</p>
          </div>
          <div>
            <Button onClick={saveDetails} disabled={busy}>
              Save details
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions (MCQ, one correct option)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {questions.map((q, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label>Question {i + 1}</Label>
                <Button variant="ghost" size="sm" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                  Remove
                </Button>
              </div>
              <Input value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Question text" />
              {q.options.map((o, oi) => (
                <div key={o.key} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${i}`} checked={q.correctKey === o.key} onChange={() => setQ(i, { correctKey: o.key })} aria-label={`Mark option ${o.key} correct`} />
                  <span className="w-5 font-mono text-sm">{o.key}</span>
                  <Input value={o.text} onChange={(e) => setQ(i, { options: q.options.map((x, xi) => (xi === oi ? { ...x, text: e.target.value } : x)) })} />
                  {q.options.length > 2 ? (
                    <Button variant="ghost" size="sm" onClick={() => setQ(i, { options: q.options.filter((_, xi) => xi !== oi), correctKey: q.correctKey === o.key ? (q.options[0]?.key ?? 'A') : q.correctKey })}>
                      ×
                    </Button>
                  ) : null}
                </div>
              ))}
              {q.options.length < 6 ? (
                <Button variant="outline" size="sm" className="w-fit" onClick={() => setQ(i, { options: [...q.options, { key: KEYS[q.options.length] ?? 'F', text: '' }] })}>
                  Add option
                </Button>
              ) : null}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setQuestions((qs) => [...qs, { text: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }], correctKey: 'A' }])}>
              Add question
            </Button>
            <Button onClick={saveQuestions} disabled={busy || questions.length === 0}>
              Save questions as draft
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={publish} disabled={busy} variant="default">
          Publish module
        </Button>
        <span className="text-muted-foreground text-sm">Publishing makes the draft questions live; Telecallers mid-attempt keep the version they started.</span>
      </div>
      {msg ? (
        <p role={msg.kind === 'err' ? 'alert' : 'status'} className={msg.kind === 'err' ? 'text-destructive text-sm' : 'text-success text-sm'}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
