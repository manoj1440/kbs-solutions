'use client';

import { Home, RotateCw, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { StatusScreen } from '@/components/status-screen';
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
    <StatusScreen
      icon={WifiOff}
      tone="rose"
      role="alert"
      title="We couldn't reach KBS right now"
      actions={
        <>
          <Button onClick={() => reset()}>
            <RotateCw />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home />
              Go to my home
            </Link>
          </Button>
        </>
      }
      footer={error.digest ? <>Reference: {error.digest}</> : null}
    >
      <p>
        The page could not load. Check your internet connection and try again. If it keeps happening, the KBS service may be down — nothing you entered is lost on the server.
      </p>
    </StatusScreen>
  );
}
