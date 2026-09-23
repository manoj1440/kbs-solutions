import 'server-only';

import type { Role } from '@kbs/shared';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSessionState } from './api';
import { safeNext } from './session-paths';

/** Server-side role gate for route-group layouts (F-801). An expired session takes the refresh hop (F-804). */
export async function requireRole(...roles: Role[]) {
  const state = await getSessionState();
  if (!state.session) {
    if (state.reason === 'deactivated') redirect('/login?reason=deactivated');
    const here = safeNext((await headers()).get('x-kbs-path'));
    redirect(`/session?next=${encodeURIComponent(here)}`);
  }
  if (!roles.includes(state.session.user.role)) redirect('/access-denied');
  return state.session;
}
