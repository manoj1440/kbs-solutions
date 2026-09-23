'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';

/** F-804: sign out here, or end every session of this account (two-step, no browser dialog). */
export function AccountActions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const leave = async (path: '/auth/logout' | '/auth/logout-all') => {
    setBusy(true);
    await clientApi.post(path, {}).catch(() => undefined);
    router.replace('/login?reason=signed-out');
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={busy} onClick={() => void leave('/auth/logout')}>
        Sign out
      </Button>
      {confirming ? (
        <>
          <Button variant="destructive" disabled={busy} onClick={() => void leave('/auth/logout-all')}>
            Yes, sign out everywhere
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)}>
          Sign out of all devices
        </Button>
      )}
    </div>
  );
}
