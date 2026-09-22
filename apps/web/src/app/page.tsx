import { redirect } from 'next/navigation';

import { getSession } from '@/lib/api';
import { homeFor } from '@/lib/roles';

export default async function Index() {
  const session = await getSession();
  if (!session) redirect('/login');
  redirect(homeFor(session.user.role));
}
