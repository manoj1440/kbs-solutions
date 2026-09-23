import { Building2 } from 'lucide-react';

import { LoginForm } from './login-form';
import { LoginShowcase } from './login-showcase';

export const metadata = { title: 'Sign in · KBS Solutions' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="admin-login grid h-dvh overflow-hidden bg-[#f7fafb] lg:grid-cols-[1.2fr_1fr]">
      <LoginShowcase />
      <section className="relative flex h-dvh min-h-0 flex-col items-center justify-center gap-6 overflow-hidden px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[420px] rounded-full bg-teal-200/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-24 size-56 rounded-full bg-cyan-200/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full bg-teal-300/20 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5 lg:hidden">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#0a1220] text-teal-300">
            <Building2 className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#0a1220]">
            KBS<span className="font-normal text-slate-500"> Solutions</span>
          </span>
        </div>
        <LoginForm next={next} />
        <p
          aria-hidden="true"
          className="absolute right-3 bottom-6 hidden font-[cursive] text-sm text-teal-600/70 italic [writing-mode:vertical-rl] xl:block"
        >
          Better Leads, Brighter Futures ↗
        </p>
      </section>
    </main>
  );
}
