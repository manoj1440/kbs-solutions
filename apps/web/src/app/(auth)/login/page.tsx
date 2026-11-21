import { Info } from 'lucide-react';
import Link from 'next/link';

import { LOGIN_NOTICES, loginReason } from '@/lib/session-paths';

import { LoginForm } from './login-form';
import { LoginShowcase } from './login-showcase';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason: rawReason } = await searchParams;
  const reason = loginReason(rawReason);
  return (
    // F-908 P7: grows and scrolls on short phones / with the keyboard open; desktop keeps the fixed two-pane look.
    <main className="admin-login grid min-h-dvh bg-canvas lg:h-dvh lg:grid-cols-[1.2fr_1fr] lg:overflow-hidden">
      <LoginShowcase />
      <section className="relative flex min-h-dvh flex-col items-center justify-center-safe gap-6 px-6 py-10 lg:h-dvh lg:min-h-0 lg:overflow-y-auto">
        <div className="relative flex items-center gap-2.5 lg:hidden">
          <span className="flex size-8 items-center justify-center brand-gradient rounded-lg text-sm font-semibold text-white" aria-hidden="true">
            K
          </span>
          <span className="text-base font-semibold text-foreground">
            KBS<span className="font-normal text-muted-foreground"> Solutions</span>
          </span>
        </div>
        {reason ? (
          <p
            role={reason === 'deactivated' ? 'alert' : 'status'}
            className={`relative flex w-full max-w-md items-start gap-2 rounded-md border px-4 py-3 text-sm ${reason === 'deactivated' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-surface-muted text-foreground'}`}
          >
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {LOGIN_NOTICES[reason]}
          </p>
        ) : null}
        <LoginForm next={next} />
        <nav aria-label="Legal" className="relative flex flex-wrap justify-center gap-x-2 text-xs text-muted-foreground">
          <Link href="/privacy" prefetch={false} className="inline-flex min-h-11 items-center rounded-md px-2 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            Privacy notice
          </Link>
          <Link href="/grievance" prefetch={false} className="inline-flex min-h-11 items-center rounded-md px-2 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            Grievances
          </Link>
        </nav>
      </section>
    </main>
  );
}
