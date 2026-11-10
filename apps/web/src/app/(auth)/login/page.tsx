import { Info } from 'lucide-react';

import { LOGIN_NOTICES, loginReason } from '@/lib/session-paths';

import { LoginForm } from './login-form';
import { LoginShowcase } from './login-showcase';

export const metadata = { title: 'Sign in · KBS Solutions' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason: rawReason } = await searchParams;
  const reason = loginReason(rawReason);
  return (
    <main className="admin-login grid h-dvh overflow-hidden bg-canvas lg:grid-cols-[1.2fr_1fr]">
      <LoginShowcase />
      <section className="relative flex h-dvh min-h-0 flex-col items-center justify-center gap-6 overflow-hidden px-6">
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
      </section>
    </main>
  );
}
