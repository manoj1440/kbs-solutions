import { Suspense } from 'react';

import { SessionHop } from './session-hop';

export const metadata = { title: 'Restoring your session · KBS Solutions' };

/** F-804: silent session refresh hop (see proxy.ts). */
export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionHop />
    </Suspense>
  );
}
