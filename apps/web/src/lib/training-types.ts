export interface TrainingTeamRow {
  telecaller: { id: string; fullName: string; employeeCode: string | null; status: string; lastLoginAt: string | null };
  status: string;
  firstLoginAt: string | null;
  deadlineAt: string | null;
  remainingMs: number | null;
  currentModuleSequence: number;
  modules: Array<{ sequence: number; status: string; bestScorePct: number | null; attemptCount: number }>;
  reactivations: number;
}
export interface TrainingDetail {
  telecaller: { id: string; fullName: string; employeeCode: string | null; status: string; lastLoginAt: string | null };
  status: string;
  firstLoginAt: string | null;
  deadlineAt: string | null;
  deadlinePassed: boolean;
  currentModuleSequence: number;
  canReactivate: boolean;
  reactivationWindowHours: number | null;
  modules: Array<{
    sequence: number;
    title: string;
    passThresholdPct: number;
    status: string;
    bestScorePct: number | null;
    attemptCount: number;
    videoCompletedAt: string | null;
    passedAt: string | null;
    attempts: Array<{ id: string; startedAt: string; submittedAt: string | null; scorePct: number | null; passed: boolean | null; moduleVersion: number }>;
  }>;
  reactivations: Array<{ id: string; at: string; byManager: { id: string; fullName: string }; reason: string; originalDeadlineAt: string | null; newDeadlineAt: string | null; resumedAtModuleSequence: number }>;
}
export const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PASSED: 'Passed',
  EXPIRED_DEACTIVATED: 'Deadline passed',
  REACTIVATED_IN_PROGRESS: 'Reactivated',
};
export const statusTone = (s: string) => (s === 'PASSED' ? 'success' : s === 'EXPIRED_DEACTIVATED' ? 'destructive' : s === 'NOT_STARTED' ? 'unknown' : 'info') as 'success' | 'destructive' | 'unknown' | 'info';
export function remaining(ms: number | null): string {
  if (ms === null) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
