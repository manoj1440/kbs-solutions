'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await clientApi.post('/auth/logout').catch(() => undefined);
        router.replace('/login?reason=signed-out');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
