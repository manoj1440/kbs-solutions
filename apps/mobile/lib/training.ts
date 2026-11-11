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
  /** Average pass rule only: this passed module may be retaken to raise the average. */
  retakeAvailable?: boolean;
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
  /** Average pass rule only: every module is passed but the average is below the required one, so a passed module may be retaken. Absent/false under the default rule. */
  canRetakeForAverage?: boolean;
  averageScorePct?: number;
  /** null unless the average pass rule is on */
  requiredAveragePct?: number | null;
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
  /** Average pass rule only: every module is passed but the average is still short. */
  canRetakeForAverage?: boolean;
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

/** One decimal at most, rounded down so an average just under the mark never reads as the mark itself. */
const pctText = (n: number) => String(Math.floor(n * 10) / 10);

/** The notice for the average pass rule, or null when the retake-for-average state does not apply (default rule, flag absent). */
export function averageRetakeNotice(
  me: Pick<TrainingMe, 'canRetakeForAverage' | 'averageScorePct' | 'requiredAveragePct'> | null | undefined,
): string | null {
  if (!me?.canRetakeForAverage) return null;
  if (typeof me.averageScorePct !== 'number' || typeof me.requiredAveragePct !== 'number') {
    return 'All modules passed, but your average is below the required average. Retake a module to raise it.';
  }
  return `All modules passed, but your average is ${pctText(me.averageScorePct)}% — ${pctText(me.requiredAveragePct)}% is needed. Retake a module to raise it.`;
}
