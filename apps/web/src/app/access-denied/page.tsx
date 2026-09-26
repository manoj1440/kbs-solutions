import { ArrowLeft, Lock, Smartphone } from 'lucide-react';
import Link from 'next/link';

import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/api';

/** Role-aware access error (REQ-25 §25.1). */
export default async function AccessDenied({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  const role = session?.user.role;
  const mobileRole = sp.reason === 'mobile-app' || role === 'TELECALLER' || role === 'ADVISOR';
  const hint = mobileRole
    ? 'Your role uses the KBS Android app. The web application is for Admin, Manager and Accounts users.'
    : 'You do not have access to this area.';
  return (
    <StatusScreen
      icon={mobileRole ? Smartphone : Lock}
      tone={mobileRole ? 'sky' : 'amber'}
      title="Access not available"
      actions={
        <Button asChild variant="outline">
          <Link href="/login">
            <ArrowLeft />
            Back to sign in
          </Link>
        </Button>
      }
    >
      <p>{hint}</p>
    </StatusScreen>
  );
}
