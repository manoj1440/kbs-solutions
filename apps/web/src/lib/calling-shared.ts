import type { RecordStatus } from '@kbs/shared';

/** Pure calling helpers shared by server pages and client tables (F-808/F-813). No server-only imports. */

export const RECORD_STATUS_VARIANT: Record<RecordStatus, 'success' | 'info' | 'warning' | 'unknown' | 'secondary' | 'destructive'> = {
  NEEDS_REVIEW: 'warning',
  EXCLUDED: 'unknown',
  DO_NOT_CONTACT: 'destructive',
  UNASSIGNED: 'warning',
  UNTOUCHED: 'secondary',
  UNREACHABLE: 'warning',
  FOLLOW_UP: 'info',
  INTERESTED: 'success',
  LINK_SHARED: 'success',
  DECLINED: 'unknown',
  COMPLETED: 'secondary',
};

export interface OverviewRow {
  id: string;
  fullName: string;
  employeeCode: string | null;
  status: string;
  training: string;
  wfhActive: boolean;
  lastLoginAt: string | null;
  queueSize: number;
  followUpsDue: number;
  attempts: number;
  connected: number;
  talkTimeSec: number;
  outcomes: Record<string, number>;
  shares: Record<string, number>;
  interests: number;
}

export function rangeParams(sp: { from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (sp.from) q.set('from', new Date(sp.from).toISOString());
  if (sp.to) q.set('to', new Date(sp.to).toISOString());
  return q.toString();
}

export const fmtTalk = (sec: number) => `${Math.floor(sec / 3600) ? `${Math.floor(sec / 3600)}h ` : ''}${Math.round((sec % 3600) / 60)}m`;
export const fmtCall = (sec: number | null) => (sec == null ? '—' : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}m ${sec % 60}s`);
