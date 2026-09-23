import { misStatusField } from '@kbs/shared';

/** F-803 gallery fixtures: every visual case a status badge must keep distinct (REQ-20 §20.2, VIEW-01). */
const AS_OF = '2026-09-20T10:30:00.000Z';
export const STATUS_SAMPLES = [
  { label: 'Never matched (no MIS row yet)', field: misStatusField(null, false, null, null) },
  { label: 'Matched, bank left the cell blank', field: misStatusField('#N/A', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Inprocess', field: misStatusField('Inprocess', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Approve', field: misStatusField('APPROVE', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Decline', field: misStatusField('Decline', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Active', field: misStatusField('ACTIVE', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Inactive', field: misStatusField('INACTIVE', true, AS_OF, 'KBS-M-DEMO1') },
] as const;
export const PAYOUT_SAMPLES = ['PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED', 'UNDER_REVIEW', 'VOID', 'PENDING_APPROVALS', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED', 'ON_HOLD'] as const;
export const SAMPLE_AS_OF = AS_OF;
