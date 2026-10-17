/**
 * F-816: on web the bank status reads in plain bank words; "MIS" is only named on the upload page. The shared/API
 * sentinels stay as they are (mobile uses them) and are reworded here at display time. Bank values pass through verbatim.
 */
const WEB_LABEL: Record<string, string> = {
  'Awaiting MIS Update': 'Awaiting bank update',
  'Awaiting MIS': 'Awaiting bank update',
};
export const AWAITING_BANK = 'Awaiting bank update';
export const bankText = (v: string) => WEB_LABEL[v] ?? v;
/** Web label per provenance (shared `PROVENANCE_LABEL` says "Bank MIS"). */
export const PROVENANCE_WEB = { BANK_MIS: 'Bank', KBS_OPERATIONAL: 'KBS activity', KBS_PAYMENT: 'Accounts payment' } as const;
