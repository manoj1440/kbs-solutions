'use client';

import { ApiClientError, type QuestionInput, type TrainingModuleView, ReplaceQuestionsBody, UpdateModuleBody } from '@kbs/shared';
import { BookOpen, CheckCircle2, GraduationCap, ListTodo, Plus, Rocket, Save, Trash2, TriangleAlert, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, EmptyState, Field, humanize, PageHeader, SectionCard, StatusDot } from '@/components/ui/kit';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

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
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        icon={GraduationCap}
        tone="sky"
        eyebrow="People · Training content"
        title={`Module ${initial.sequence}`}
        description={
          <>
            Live version {initial.version} · {initial.questionCount} questions
            {initial.draftVersion ? ` · draft v${initial.draftVersion} (${initial.draftQuestionCount ?? 0} questions) awaiting publish` : ''}
          </>
        }
        actions={<Badge variant={initial.status === 'PUBLISHED' ? 'success' : 'warning'}>{humanize(initial.status)}</Badge>}
      />

      <SectionCard icon={BookOpen} tone="sky" title="Details" description="Title, pass mark, learning material and the module video.">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Title" htmlFor="title">
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Pass threshold (%)" htmlFor="threshold">
              <Input id="threshold" type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="tabular-nums" />
            </Field>
          </div>
          <Field label="Learning material (optional, markdown)" htmlFor="material">
            <textarea id="material" className="min-h-32 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-[inset_0_1px_1px_rgb(15_23_42/3%)] outline-none hover:border-slate-300 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </Field>
          <div className="grid gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <Field label="Video (mp4/webm)" htmlFor="video">
              <Input id="video" type="file" accept="video/mp4,video/webm" onChange={(e) => e.target.files?.[0] && void uploadVideo(e.target.files[0])} />
            </Field>
            <p className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
              <Video className="size-3.5 shrink-0" aria-hidden="true" />
              <StatusDot tone={videoFileId ? 'emerald' : 'slate'}>
                <span className="break-all">{videoFileId ? `Attached file ${videoFileId}` : 'No video attached'}</span>
              </StatusDot>
            </p>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <Button onClick={saveDetails} disabled={busy}>
              <Save />
              Save details
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={ListTodo}
        tone="violet"
        title="Questions (MCQ, one correct option)"
        description="Select the radio button next to the correct option."
        actions={
          <Badge variant="secondary" className="tabular-nums">
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </Badge>
        }
      >
        <div className="grid gap-4">
          {questions.map((q, i) => (
            <div key={i} className="grid gap-2.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <span className="inline-flex size-6 items-center justify-center rounded-lg bg-violet-50 text-[11px] text-violet-700 tabular-nums ring-1 ring-violet-100">{i + 1}</span>
                  <Label>Question {i + 1}</Label>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                  <Trash2 />
                  Remove
                </Button>
              </div>
              <Input value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Question text" />
              <div className="grid gap-2 pl-1">
                {q.options.map((o, oi) => (
                  <div key={o.key} className={cn('flex items-center gap-2 rounded-lg px-1.5 py-1', q.correctKey === o.key && 'bg-emerald-50/70 ring-1 ring-emerald-100')}>
                    <input type="radio" className="accent-emerald-600" name={`correct-${i}`} checked={q.correctKey === o.key} onChange={() => setQ(i, { correctKey: o.key })} aria-label={`Mark option ${o.key} correct`} />
                    <span className={cn('w-5 font-mono text-sm', q.correctKey === o.key ? 'font-semibold text-emerald-700' : 'text-slate-500')}>{o.key}</span>
                    <Input value={o.text} onChange={(e) => setQ(i, { options: q.options.map((x, xi) => (xi === oi ? { ...x, text: e.target.value } : x)) })} />
                    {q.options.length > 2 ? (
                      <Button variant="ghost" size="sm" onClick={() => setQ(i, { options: q.options.filter((_, xi) => xi !== oi), correctKey: q.correctKey === o.key ? (q.options[0]?.key ?? 'A') : q.correctKey })}>
                        ×
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              {q.options.length < 6 ? (
                <Button variant="outline" size="sm" className="w-fit" onClick={() => setQ(i, { options: [...q.options, { key: KEYS[q.options.length] ?? 'F', text: '' }] })}>
                  <Plus />
                  Add option
                </Button>
              ) : null}
            </div>
          ))}
          {questions.length === 0 ? <EmptyState icon={ListTodo} title="No questions" description="Add at least one question before saving the draft." /> : null}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setQuestions((qs) => [...qs, { text: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }], correctKey: 'A' }])}>
              <Plus />
              Add question
            </Button>
            <Button onClick={saveQuestions} disabled={busy || questions.length === 0}>
              <Save />
              Save questions as draft
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Rocket} tone="emerald" title="Publish" description="Publishing makes the draft questions live; Telecallers mid-attempt keep the version they started.">
        <Button onClick={publish} disabled={busy} variant="default">
          <Rocket />
          Publish module
        </Button>
      </SectionCard>
      {msg ? (
        <Callout tone={msg.kind === 'err' ? 'danger' : 'success'} icon={msg.kind === 'err' ? TriangleAlert : CheckCircle2} role={msg.kind === 'err' ? 'alert' : 'status'}>
          {msg.text}
        </Callout>
      ) : null}
    </div>
  );
}
