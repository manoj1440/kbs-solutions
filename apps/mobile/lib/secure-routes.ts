/**
 * F-302 / REQ-09 §9.3: one source of truth for which screens get FLAG_SECURE — customer lists and details, PAN and
 * bank entry, Advisor identity/bank records, call and payout materials. Marketing, sign-in and onboarding intro
 * screens (S01–S05), training and notifications stay capturable. Keys are Expo Router segments: `(group)/leaf`,
 * where a group's index screen is `(group)/index`.
 */
export const PROTECTED_ROUTES: ReadonlySet<string> = new Set([
  // Telecaller: queue, customer card / record, official ID
  '(telecaller)/index',
  '(telecaller)/record',
  '(telecaller)/card',
  '(telecaller)/id-card',
  // Advisor: customer leads (PAN), payout ledger / requests, profile with bank details
  '(advisor)/index',
  '(advisor)/lead-new',
  '(advisor)/lead',
  '(advisor)/lead-created',
  '(advisor)/leads',
  '(advisor)/payouts',
  '(advisor)/payout-request',
  '(advisor)/profile',
  // Manager: team customers / calls, payout approvals and requests
  '(manager)/index',
  '(manager)/telecaller',
  '(manager)/approvals',
  '(manager)/payout-request',
  // Onboarding gate collects identity and bank details
  '(gates)/onboarding',
]);

export function routeKey(segments: readonly string[]): string {
  const group = segments.find((s) => s.startsWith('(')) ?? '';
  const rest = segments.filter((s) => !s.startsWith('('));
  return `${group}/${rest[0] ?? 'index'}`;
}

export function isProtectedRoute(segments: readonly string[]): boolean {
  return PROTECTED_ROUTES.has(routeKey(segments));
}
