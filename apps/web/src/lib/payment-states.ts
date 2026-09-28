/** Payment-entry state badge map — shared by the request detail page and its client tables (F-604/F-605). */
export const PAYMENT_STATE: Record<string, { label: string; tone: 'success' | 'warning' | 'destructive' | 'info' | 'unknown' }> = {
  VERIFIED: { label: 'verified', tone: 'success' },
  PROOF_PENDING: { label: 'proof pending', tone: 'warning' },
  RECORDED: { label: 'recorded', tone: 'info' },
  EXCEPTION: { label: 'exception', tone: 'destructive' },
  CORRECTION_PENDING: { label: 'correction awaiting Admin', tone: 'warning' },
  SUPERSEDED: { label: 'superseded', tone: 'unknown' },
  CORRECTION_REJECTED: { label: 'correction rejected', tone: 'unknown' },
};
