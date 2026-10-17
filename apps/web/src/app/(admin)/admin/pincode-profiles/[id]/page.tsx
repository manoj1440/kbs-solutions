import { redirect } from 'next/navigation';

/** F-816: every bank uses the standard coverage format, so there is no profile to edit — old links land on Bank coverage. */
export default function PincodeProfileRedirect() {
  redirect('/admin/pincode-profiles');
}
