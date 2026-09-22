import type { Gates, UserSummary } from '@kbs/shared';

/** Where the app should send the user, from role + gates (REQ-04 §4.2). */
export function routeFor(user: UserSummary, gates: Gates): string {
  if (!gates.account.active) return '/(gates)/deactivated';
  if (user.role === 'TELECALLER') {
    if (gates.training.required && !gates.training.passed) return '/(gates)/training';
    if (gates.network.required && !gates.network.allowed) return '/(gates)/network-blocked';
    return '/(telecaller)';
  }
  if (user.role === 'ADVISOR') {
    if (gates.onboarding.required && !gates.onboarding.complete) return '/(gates)/onboarding';
    return '/(advisor)';
  }
  if (user.role === 'MANAGER') return '/(manager)';
  return '/(gates)/deactivated';
}
