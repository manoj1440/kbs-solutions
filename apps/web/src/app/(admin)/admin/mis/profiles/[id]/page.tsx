import { redirect } from 'next/navigation';

/** F-816: every bank uses the standard MIS format, so there is no profile to edit — old links land on the upload page. */
export default function MisProfileRedirect() {
  redirect('/admin/mis');
}
