import { z } from 'zod';

// ── F-202 content administration ──
export const QuestionOption = z.object({ key: z.string().regex(/^[A-F]$/), text: z.string().trim().min(1).max(500) });
export const QuestionInput = z
  .object({
    text: z.string().trim().min(3).max(1000),
    options: z.array(QuestionOption).min(2).max(6),
    correctKey: z.string().regex(/^[A-F]$/),
  })
  .refine((q) => new Set(q.options.map((o) => o.key)).size === q.options.length, 'Option keys must be unique')
  .refine((q) => q.options.some((o) => o.key === q.correctKey), 'correctKey must be one of the options');
export type QuestionInput = z.infer<typeof QuestionInput>;

export const UpdateModuleBody = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  materialText: z.string().max(20_000).nullable().optional(),
  passThresholdPct: z.number().int().min(1).max(100).optional(),
  videoFileId: z.string().uuid().nullable().optional(),
});
export type UpdateModuleBody = z.infer<typeof UpdateModuleBody>;

export const ReplaceQuestionsBody = z.object({ questions: z.array(QuestionInput).min(1).max(100) });
export type ReplaceQuestionsBody = z.infer<typeof ReplaceQuestionsBody>;

// ── F-203 learner flow ──
export const VideoProgressBody = z.object({ positionSec: z.number().min(0), durationSec: z.number().min(0).optional(), completed: z.boolean() });
export type VideoProgressBody = z.infer<typeof VideoProgressBody>;

export const SubmitAttemptBody = z.object({ answers: z.record(z.string().uuid(), z.string().regex(/^[A-F]$/)) });
export type SubmitAttemptBody = z.infer<typeof SubmitAttemptBody>;

export const TrainingModuleView = z.object({
  id: z.string().uuid(),
  sequence: z.number().int(),
  title: z.string(),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  version: z.number().int(),
  draftVersion: z.number().int().nullable(),
  passThresholdPct: z.number().int(),
  materialText: z.string().nullable(),
  videoFileId: z.string().uuid().nullable(),
  questionCount: z.number().int(),
  publishedAt: z.string().nullable(),
});
export type TrainingModuleView = z.infer<typeof TrainingModuleView>;
