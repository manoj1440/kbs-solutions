import { Compass, Home } from 'lucide-react';
import Link from 'next/link';

import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';

/** F-804: unknown URL or a record the user cannot see (API 404s surface as not-found). */
export default function NotFound() {
  return (
    <StatusScreen
      icon={Compass}
      tone="indigo"
      title="Page not found"
      actions={
        <Button asChild>
          <Link href="/">
            <Home />
            Go to my home
          </Link>
        </Button>
      }
    >
      <p>This page does not exist, or the record is not available to your account.</p>
    </StatusScreen>
  );
}
