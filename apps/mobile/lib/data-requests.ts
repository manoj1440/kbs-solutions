import { DataRequestCreateBody, type DataRequestStatus, type DataRequestType, type PersonalDataExport } from '@kbs/shared';

/** Badge tone for a request status: text always carries the meaning, colour only supports it. */
export function requestTone(status: DataRequestStatus): 'info' | 'warning' | 'success' | 'secondary' {
  switch (status) {
    case 'OPEN':
      return 'info';
    case 'IN_PROGRESS':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    default:
      return 'secondary';
  }
}

/** Client-side check with the API's own schema; returns the first message or null. */
export function requestError(type: DataRequestType, details: string): string | null {
  const r = DataRequestCreateBody.safeParse({ type, details: details.trim() || undefined });
  return r.success ? null : (r.error.issues[0]?.message ?? 'Check the details.');
}

/** One-line summary of a download, shown after it is shared. */
export function exportSummary(x: PersonalDataExport): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return [n(x.leads.length, 'lead', 'leads'), n(x.payoutRequests.length, 'payout request', 'payout requests'), n(x.sessions.length, 'sign-in', 'sign-ins')].join(', ');
}
