/** Accounts queues (REQ-18 §18.1). Exceptions include proof pending, holds and entries awaiting Admin. */
export const PAYMENT_QUEUE_WHERE = {
  awaiting: { state: 'APPROVED' as const },
  paid: { state: 'PAID' as const },
  exceptions: { OR: [{ state: { in: ['ON_HOLD', 'PAYMENT_RECORDED_PENDING_PROOF'] as ('ON_HOLD' | 'PAYMENT_RECORDED_PENDING_PROOF')[] } }, { payments: { some: { state: { in: ['EXCEPTION', 'CORRECTION_PENDING'] as ('EXCEPTION' | 'CORRECTION_PENDING')[] } } } }] },
};
