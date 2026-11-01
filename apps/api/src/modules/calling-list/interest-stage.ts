import { activationBucket, decisionBucket } from '@kbs/shared';

/** A21: where a Telecaller's calling interest stands. Bank wording only when the MIS reported it. */
export type InterestStage = 'AWAITING_REFERENCE' | 'AWAITING_BANK_UPDATE' | 'IN_PROCESS' | 'APPROVED' | 'DECLINED';
export type StageCounts = Record<InterestStage | 'total' | 'activated', number>;

export function interestStage(i: { bankReferenceValue: string | null; bankStatus: { finalDecision: string | null } | null }): InterestStage {
  if (!i.bankReferenceValue) return 'AWAITING_REFERENCE';
  if (!i.bankStatus) return 'AWAITING_BANK_UPDATE';
  if (!i.bankStatus.finalDecision) return 'IN_PROCESS';
  const b = decisionBucket(i.bankStatus.finalDecision);
  return b === 'approved' ? 'APPROVED' : b === 'declined' ? 'DECLINED' : 'IN_PROCESS';
}

export const emptyStageCounts = (): StageCounts => ({ total: 0, AWAITING_REFERENCE: 0, AWAITING_BANK_UPDATE: 0, IN_PROCESS: 0, APPROVED: 0, DECLINED: 0, activated: 0 });

/** Per-Telecaller stage counts from `callingInterest.findMany({ select: { telecallerUserId, bankReferenceValue, bankStatus: { finalDecision, cardActivationStatus } } })`. */
export function countStages(rows: { telecallerUserId: string; bankReferenceValue: string | null; bankStatus: { finalDecision: string | null; cardActivationStatus: string | null } | null }[]) {
  const out = new Map<string, StageCounts>();
  for (const r of rows) {
    const c = out.get(r.telecallerUserId) ?? emptyStageCounts();
    c.total++;
    c[interestStage(r)]++;
    if (r.bankStatus?.cardActivationStatus && activationBucket(r.bankStatus.cardActivationStatus) === 'active') c.activated++;
    out.set(r.telecallerUserId, c);
  }
  return out;
}

export const STAGE_SELECT = { telecallerUserId: true, bankReferenceValue: true, bankStatus: { select: { finalDecision: true, cardActivationStatus: true } } } as const;
