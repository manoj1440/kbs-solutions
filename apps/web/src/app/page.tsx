import { redirect } from 'next/navigation';

import { getSessionState } from '@/lib/api';
import { homeFor } from '@/lib/roles';

export default async function Index() {
  const state = await getSessionState();
  if (state.session) redirect(homeFor(state.session.user.role));
  if (state.reason === 'deactivated') redirect('/login?reason=deactivated');
  // no or lapsed access cookie: try the refresh hop once; with no refresh cookie it lands on a plain /login
  redirect('/session?next=%2F');
}
