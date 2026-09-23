import { z } from 'zod';

/**
 * F-702 / F-703 dashboard filters (REQ-15 §15.2, REQ-16 §16.2–§16.3). One query shape for every dashboard so the
 * Manager view and the Admin view filtered to that team are computed by the same code (DASH-02).
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const MIS_RECENCY = ['within7', 'within30', 'older30', 'never'] as const;
export const DashboardQuery = z.object({
  from: day.optional(),
  to: day.optional(),
  managerId: z.string().uuid().optional(),
  telecallerId: z.string().uuid().optional(),
  advisorId: z.string().uuid().optional(),
  bankId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  state: z.string().trim().min(2).max(60).optional(),
  /** Lead's last matching MIS batch age (REQ-15 §15.2 "current MIS recency"). */
  misRecency: z.enum(MIS_RECENCY).optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuery>;

/** Every figure carries its source and date basis so a connected call is never confused with a bank activation. */
export const METRIC_SOURCES = ['KBS_CALLING', 'TELEPHONY_PROVIDER', 'KBS_SHARING', 'KBS_LEADS', 'BANK_MIS', 'KBS_PAYOUT_LEDGER', 'ACCOUNTS_PAYMENT'] as const;
export type MetricSource = (typeof METRIC_SOURCES)[number];
export interface Metric {
  value: number;
  /** Amount in INR when the metric is money. */
  amountInr?: number;
  denominator?: { label: string; value: number };
  source: MetricSource;
  dateBasis: string;
}
export interface Distribution {
  source: MetricSource;
  dateBasis: string;
  /** Raw bank values verbatim, plus 'Not reported' (matched, blank) and 'Awaiting MIS' (never matched). */
  buckets: { value: string; count: number }[];
  denominator: { label: string; value: number };
}

// ── F-315 Manager Advisor drill-down (`GET /dashboards/manager/advisors`) ──
export interface AdvisorTeamRow {
  user: { id: string; fullName: string; publicRef: string; status: string; mobileMasked: string | null; joinedAt: string };
  reporting: { source: string; since: string; parent: { id: string; fullName: string }; agentCode: string | null } | null;
  leads: { created: Metric; misMatched: Metric; awaitingMis: Metric };
  stage: Distribution;
  decision: Distribution;
  activation: Distribution;
  bankReasons: { leadsWithReason: Metric; top: { value: string; count: number }[] };
  payouts: { eligible: Metric; available: Metric; requested: Metric; approvedUnpaid: Metric; onHold: Metric; paid: Metric; confirmedTransfersInr: Metric };
  /** Requests by this Advisor still waiting for a Manager decision. */
  awaitingManagerApproval: number;
}
export interface AdvisorTeamResponse {
  scope: string;
  rows: AdvisorTeamRow[];
  meta: { from: string | null; to: string | null; asOf: string; note: string; misFreshness: { bank: { id: string; displayName: string }; lastAppliedAt: string | null }[] };
}
/** How the Advisor came to report to their parent (plain words for Manager screens). */
export const REPORTING_SOURCE_LABELS: Record<string, string> = {
  AGENT_CODE: 'Agent Code',
  ADMIN_DEFAULT: 'Assigned by Admin (no code)',
  ADMIN_REASSIGNED: 'Reassigned by Admin',
  MANAGER_CREATED_TELECALLER: 'Created by Manager',
};
