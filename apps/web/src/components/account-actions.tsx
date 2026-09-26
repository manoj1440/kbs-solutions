'use client';

import { LogOut, MonitorX } from 'lucide-react';
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
        <LogOut />
        Sign out
      </Button>
      {confirming ? (
        <>
          <Button variant="destructive" disabled={busy} onClick={() => void leave('/auth/logout-all')}>
            <MonitorX />
            Yes, sign out everywhere
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)} className="text-rose-700 hover:text-rose-800">
          <MonitorX />
          Sign out of all devices
        </Button>
      )}
    </div>
  );
}
