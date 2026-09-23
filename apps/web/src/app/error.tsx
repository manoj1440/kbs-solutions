'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * F-804 (REQ-25 §25.1 "no-connection/retry", REQ-23): shown when a page cannot be rendered — usually the API is
 * unreachable or failed. No internal message or stack is shown; the digest lets support find the server log line.
 */
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[KBS] page render failed', error.digest ?? '');
  }, [error]);
  return (
    <main className="flex min-h-[60dvh] items-center justify-center p-4">
      <div role="alert" className="grid max-w-md gap-3 rounded-xl border bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">We couldn&apos;t reach KBS right now</h1>
        <p className="text-muted-foreground text-sm">
          The page could not load. Check your internet connection and try again. If it keeps happening, the KBS service may be down — nothing you entered is lost on the server.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go to my home</Link>
          </Button>
        </div>
        {error.digest ? <p className="text-muted-foreground text-xs">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
