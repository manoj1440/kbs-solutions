import type { Role } from '@kbs/shared';

/** Role → home route on the web app (REQ-02 §2.3: web is for Admin, Manager, Accounts). */
export const WEB_HOME: Partial<Record<Role, string>> = { ADMIN: '/admin', MANAGER: '/manager', ACCOUNTS: '/accounts' };

export function homeFor(role: Role): string {
  return WEB_HOME[role] ?? '/access-denied';
}
