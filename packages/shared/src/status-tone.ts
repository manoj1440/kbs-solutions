import { AWAITING_MIS_UPDATE, NOT_REPORTED } from './display';
import type { StatusField } from './display';

/**
 * F-803 (REQ-20 §20.2): one tone + label vocabulary for web and mobile badges. Tone only groups visually — the text is
 * always rendered, and "Awaiting MIS Update" / "Not reported" stay neutral so they are never mistaken for a bank value.
 */
export type StatusTone = 'success' | 'destructive' | 'warning' | 'info' | 'unknown' | 'secondary';
export type StatusKind = 'stage' | 'decision' | 'activation';

export function statusTone(kind: StatusKind, field: StatusField): StatusTone {
  if (!field.value || field.display === AWAITING_MIS_UPDATE || field.display === NOT_REPORTED) return 'unknown';
  const v = field.value.toUpperCase();
  if (kind === 'decision') return v === 'APPROVE' ? 'success' : v === 'DECLINE' ? 'destructive' : v === 'INPROCESS' ? 'warning' : 'secondary';
  if (kind === 'activation') return v.includes('ACTIVE') && !v.startsWith('INACTIVE') ? 'success' : v === 'INACTIVE' ? 'warning' : 'secondary';
  return 'info';
}

const PAYOUT_BAD = new Set(['REJECTED', 'ON_HOLD', 'CANCELLED', 'VOID']);
const PAYOUT_INFO = new Set(['APPROVED', 'ELIGIBLE_AVAILABLE']);

export function payoutStateTone(state: string): StatusTone {
  if (state === 'PAID') return 'success';
  if (PAYOUT_BAD.has(state)) return 'destructive';
  if (PAYOUT_INFO.has(state)) return 'info';
  return 'warning';
}

export function payoutStateLabel(state: string): string {
  return state.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export const PROVENANCE_LABEL = { BANK_MIS: 'Bank MIS', KBS_OPERATIONAL: 'KBS activity', KBS_PAYMENT: 'Accounts payment' } as const;
