import type { Role } from '@kbs/shared';

import { homeFor } from './roles';

/** F-804: why the user is on the login screen. */
export const LOGIN_REASONS = ['session-expired', 'deactivated', 'signed-out', 'required'] as const;
export type LoginReason = (typeof LOGIN_REASONS)[number];
export const LOGIN_NOTICES: Record<LoginReason, string> = {
  'session-expired': 'Your session ended. Sign in again to continue where you left off.',
  deactivated: 'This account has been deactivated. Contact your Manager or the KBS Admin.',
  'signed-out': 'You have signed out.',
  required: 'Sign in to continue.',
};
export function loginReason(raw: string | null | undefined): LoginReason | null {
  return (LOGIN_REASONS as readonly string[]).includes(raw ?? '') ? (raw as LoginReason) : null;
}

/** Only same-site absolute paths survive; anything else (other hosts, `//x`, `/\\x`, schemes) becomes `/`. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (/[\u0000-\u001f]/.test(raw)) return '/';
  return raw;
}

/** After sign-in: go back to `next` only when it lies inside the user's own area, else the role home. */
export function nextForRole(raw: string | null | undefined, role: Role): string {
  const home = homeFor(role);
  const next = safeNext(raw);
  if (home === '/access-denied') return home;
  return next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`) ? next : home;
}

/**
 * Where the session hop sends the user when the API refuses to refresh. Always carries a reason: that tells the
 * proxy to drop a stale access cookie, so /login cannot bounce back into the areas.
 */
export function loginUrlFor(errorCode: string | null, next: string): string {
  const q = new URLSearchParams();
  q.set('reason', errorCode === 'AUTH_ACCOUNT_DEACTIVATED' ? 'deactivated' : errorCode === 'AUTH_SESSION_REVOKED' ? 'session-expired' : 'required');
  const n = safeNext(next);
  if (n !== '/') q.set('next', n);
  const s = q.toString();
  return `/login${s ? `?${s}` : ''}`;
}
