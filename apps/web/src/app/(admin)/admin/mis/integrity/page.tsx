import { redirect } from 'next/navigation';

/** F-809: the integrity dashboard left the Admin UI — deep links land on Bank MIS. */
export default function MisIntegrityRedirect() {
  redirect('/admin/mis');
}
