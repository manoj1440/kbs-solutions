import { Building2, Info } from 'lucide-react';

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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[420px] rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-24 size-56 rounded-full bg-orange-100/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full bg-stone-400/20 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5 lg:hidden">
          <span className="flex size-9 items-center justify-center brand-gradient rounded-full text-white">
            <Building2 className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            KBS<span className="font-normal text-muted-foreground"> Solutions</span>
          </span>
        </div>
        {reason ? (
          <p
            role={reason === 'deactivated' ? 'alert' : 'status'}
            className={`relative flex w-full max-w-md items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${reason === 'deactivated' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-stone-300 bg-stone-100 text-stone-950'}`}
          >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {LOGIN_NOTICES[reason]}
          </p>
        ) : null}
        <LoginForm next={next} />
      </section>
    </main>
  );
}
