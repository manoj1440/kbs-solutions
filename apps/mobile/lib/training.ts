import { api } from './api';

export interface TrainingModuleState {
  sequence: number;
  title: string;
  published: boolean;
  version: number;
  passThresholdPct: number;
  videoFileId: string | null;
  materialText: string | null;
  status: 'LOCKED' | 'IN_PROGRESS' | 'PASSED';
  bestScorePct: number | null;
  attemptCount: number;
  attemptsRemaining: number | null;
  videoCompletedAt: string | null;
  assessmentAvailable: boolean;
  passedAt: string | null;
}
export interface TrainingMe {
  status: string;
  firstLoginAt: string | null;
  deadlineAt: string | null;
  deadlinePassed: boolean;
  currentModuleSequence: number;
  attemptLimit: number | null;
  modules: TrainingModuleState[];
}
export interface AttemptStart {
  attemptId: string;
  moduleSequence: number;
  passThresholdPct: number;
  questions: { id: string; text: string; options: { key: string; text: string }[] }[];
}
export interface AttemptResult {
  moduleSequence: number;
  scorePct: number;
  passThresholdPct: number;
  passed: boolean;
  correct: number;
  total: number;
  allModulesPassed: boolean;
  nextModuleSequence: number | null;
  deadlinePassed: boolean;
  retryAvailable: boolean;
}

export const training = {
  me: () => api.get<TrainingMe>('/training/me').then((r) => r.data),
  videoProgress: (seq: number, positionSec: number, durationSec: number | undefined, completed: boolean) =>
    api.post(`/training/modules/${seq}/video-progress`, { positionSec, durationSec, completed }),
  start: (seq: number) => api.post<AttemptStart>(`/training/modules/${seq}/attempts`).then((r) => r.data),
  submit: (attemptId: string, answers: Record<string, string>) => api.post<AttemptResult>(`/training/attempts/${attemptId}/submit`, { answers }).then((r) => r.data),
  fileUrl: (id: string) => api.get<{ url: string }>(`/files/${id}/url`).then((r) => r.data.url),
};

export function countdown(deadlineAt: string | null): string {
  if (!deadlineAt) return '';
  const ms = new Date(deadlineAt).getTime() - Date.now();
  if (ms <= 0) return 'Window ended';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}
