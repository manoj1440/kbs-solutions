import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSession } from '@/lib/api';

/** Role-aware access error (REQ-25 §25.1). */
export default async function AccessDenied() {
  const session = await getSession();
  const role = session?.user.role;
  const hint =
    role === 'TELECALLER' || role === 'ADVISOR'
      ? 'Your role uses the KBS Android app. The web application is for Admin, Manager and Accounts users.'
      : 'You do not have access to this area.';
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Access not available</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
