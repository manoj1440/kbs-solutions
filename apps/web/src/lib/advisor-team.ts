import { formatInr } from '@kbs/shared';

/** F-315 `GET /dashboards/manager/advisors` row (F-702 metric engine per Advisor). */
export interface Metric {
  value: number;
  amountInr?: number;
  denominator?: { label: string; value: number };
  source: string;
  dateBasis: string;
}
export interface Distribution {
  source: string;
  dateBasis: string;
  buckets: { value: string; count: number }[];
  denominator: { label: string; value: number };
}
export interface AdvisorTeamRow {
  user: { id: string; fullName: string; publicRef: string; status: string; mobileMasked: string | null; joinedAt: string };
  reporting: { source: string; since: string; parent: { id: string; fullName: string }; agentCode: string | null } | null;
  leads: { created: Metric; misMatched: Metric; awaitingMis: Metric };
  stage: Distribution;
  decision: Distribution;
  activation: Distribution;
  bankReasons: { leadsWithReason: Metric; top: { value: string; count: number }[] };
  payouts: { eligible: Metric; available: Metric; requested: Metric; approvedUnpaid: Metric; onHold: Metric; paid: Metric; confirmedTransfersInr: Metric };
  awaitingManagerApproval: number;
}
export interface AdvisorTeamResponse {
  scope: string;
  rows: AdvisorTeamRow[];
  meta: { from: string | null; to: string | null; asOf: string; note: string; misFreshness: { bank: { id: string; displayName: string }; lastAppliedAt: string | null }[] };
}

export const REPORTING_LABEL: Record<string, string> = {
  AGENT_CODE: 'Agent Code',
  ADMIN_DEFAULT: 'Assigned by Admin (no code)',
  ADMIN_REASSIGNED: 'Reassigned by Admin',
  MANAGER_CREATED_TELECALLER: 'Created by Manager',
};
export const SOURCE_LABEL: Record<string, string> = { KBS_LEADS: 'KBS leads', BANK_MIS: 'bank MIS', KBS_PAYOUT_LEDGER: 'payout ledger', ACCOUNTS_PAYMENT: 'Accounts payments' };

export function inr(n: number | undefined): string {
  return formatInr(n ?? 0, { decimals: 0 });
}
