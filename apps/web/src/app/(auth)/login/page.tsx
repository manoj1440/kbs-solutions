import { Building2, ShieldCheck } from 'lucide-react';

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
    <main className="admin-login grid h-dvh overflow-hidden bg-[#f4f6f9] lg:grid-cols-[1.15fr_1fr]">
      <LoginShowcase />
      <section className="relative flex h-dvh min-h-0 flex-col items-center justify-center gap-5 overflow-hidden px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(15,118,110,0.07)_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div className="relative flex items-center gap-2.5 lg:hidden">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#0c1526] text-teal-300">
            <Building2 className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#0c1526]">
            KBS<span className="font-normal text-slate-500"> Solutions</span>
          </span>
        </div>
        <div className="relative w-full max-w-md">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-teal-800 uppercase">
            Welcome to your workspace
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Let’s get to business.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Secure sign-in for Admin, Managers and Accounts. Use your registered mobile number to
            continue.
          </p>
        </div>
        <LoginForm next={next} />
        <p className="relative flex max-w-md items-center gap-2 text-center text-xs text-slate-500">
          <ShieldCheck className="size-4 shrink-0" />
          Access is based on your assigned role. Need access? Contact your KBS administrator.
        </p>
      </section>
    </main>
  );
}
