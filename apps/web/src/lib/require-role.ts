import 'server-only';

import type { Role } from '@kbs/shared';
import { redirect } from 'next/navigation';

import { getSession } from './api';

/** Server-side role gate for route-group layouts (F-801). */
export async function requireRole(...roles: Role[]) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!roles.includes(session.user.role)) redirect('/access-denied');
  return session;
}
