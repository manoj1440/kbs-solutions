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
  if (kind === 'decision') {
    const b = decisionBucket(v); // banks write Approve / Approved / APPROVED
    return b === 'approved' ? 'success' : b === 'declined' ? 'destructive' : 'warning';
  }
  if (kind === 'activation') {
    const b = activationBucket(v); // same reading as the counts: Active / Activated / Card Activated vs Inactive / Not active
    return b === 'active' ? 'success' : b === 'inactive' ? 'warning' : 'secondary';
  }
  return 'info';
}

/** Business bucket for a bank-verbatim decision value (blank already excluded). Loose on purpose: banks write Approve/Approved/APPROVED. */
export const decisionBucket = (v: string): 'approved' | 'declined' | 'inProcess' => (/approv/i.test(v) ? 'approved' : /declin|reject/i.test(v) ? 'declined' : 'inProcess');

/** Business bucket for a bank-verbatim activation value: inactive/active, or null when the value is neither. */
/**
 * Bank activation text → bucket. Banks write free text ("V + ACTIVE", "TXN ACTIVE - Rs 100", "INACTIVE"), and a payout
 * entitlement is created from `active`, so this must not guess: only the whole word ACTIVE / ACTIVATED counts, and any
 * negated or not-yet wording ("NOT ACTIVE", "DEACTIVATED", "ACTIVATION PENDING", "YET TO ACTIVATE") never does.
 * `null` = cannot tell → no entitlement, neutral badge (INV-02 spirit: unknown is not a status).
 */
export const activationBucket = (v: string): 'active' | 'inactive' | null => {
  if (/\b(in[-\s]?active|in[-\s]?activated|not\s+activ\w*|non[-\s]?activ\w*|de[-\s]?activ\w*|un[-\s]?activ\w*)\b/i.test(v)) return 'inactive';
  if (/\b(pending|awaiting|awaited|yet\s+to|to\s+be|not)\b/i.test(v)) return null;
  return /\b(active|activated)\b/i.test(v) ? 'active' : null;
};

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
