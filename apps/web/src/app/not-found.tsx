import Link from 'next/link';

import { Button } from '@/components/ui/button';

/** F-804: unknown URL or a record the user cannot see (API 404s surface as not-found). */
export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center p-4">
      <div className="grid max-w-md gap-3 rounded-xl border bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground text-sm">This page does not exist, or the record is not available to your account.</p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/">Go to my home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
