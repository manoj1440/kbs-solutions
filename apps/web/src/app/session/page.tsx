import { Suspense } from 'react';

import { SessionHop } from './session-hop';

export const metadata = { title: 'Restoring your session · KBS Solutions' };

/** F-804: silent session refresh hop (see proxy.ts). */
export default function SessionPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Suspense fallback={null}>
        <SessionHop />
      </Suspense>
    </main>
  );
}
