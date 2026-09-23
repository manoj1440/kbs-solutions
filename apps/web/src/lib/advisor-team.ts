import { formatInr } from '@kbs/shared';

export type { AdvisorTeamResponse, AdvisorTeamRow, Distribution, Metric } from '@kbs/shared';
export { REPORTING_SOURCE_LABELS as REPORTING_LABEL } from '@kbs/shared';

export const SOURCE_LABEL: Record<string, string> = { KBS_LEADS: 'KBS leads', BANK_MIS: 'bank MIS', KBS_PAYOUT_LEDGER: 'payout ledger', ACCOUNTS_PAYMENT: 'Accounts payments' };

export function inr(n: number | undefined): string {
  return formatInr(n ?? 0, { decimals: 0 });
}
