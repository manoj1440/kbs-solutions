import { ArrowUpRight, Building2, FileSpreadsheet, ShieldCheck, Users, Wallet } from 'lucide-react';

import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in · KBS Solutions' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="admin-login grid min-h-screen bg-[#f4f6f9] lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#111e30] p-8 text-white sm:p-12 lg:min-h-screen lg:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-56 -right-56 size-[600px] rounded-full border border-white/5 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.10),transparent_65%)]"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-teal-300 text-slate-900">
            <Building2 className="size-6" />
          </span>
          <span className="text-xl font-bold tracking-tight">
            KBS<span className="font-normal text-slate-300"> Solutions</span>
          </span>
        </div>
        <div className="relative my-12 max-w-lg lg:my-20">
          <p className="mb-6 text-[11px] font-semibold tracking-[0.2em] text-teal-300 uppercase">
            The business behind every card
          </p>
          <h1 className="text-4xl leading-[1.14] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Every lead.
            <br />
            Every decision.
            <br />
            <span className="text-teal-300">One clear view.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-slate-300">
            Your people, bank data and payouts—connected in one workspace. Less searching. More
            clarity.
          </p>
          <div className="mt-10 hidden gap-3 sm:grid">
            {[
              {
                icon: Users,
                title: 'People & operations',
                text: 'Teams, advisors and lead activity',
              },
              {
                icon: FileSpreadsheet,
                title: 'Bank MIS intelligence',
                text: 'Evidence-backed status and exception review',
              },
              {
                icon: Wallet,
                title: 'Payout oversight',
                text: 'Eligibility, dual approvals and payment visibility',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <span className="rounded-lg bg-teal-300/10 p-2.5">
                  <Icon className="size-5 text-teal-300" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs text-slate-400">{text}</p>
                </div>
                <ArrowUpRight className="size-4 text-slate-500" />
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-4 text-teal-300" />
          Bank outcomes backed by uploaded MIS. Always.
        </div>
      </section>
      <section className="flex flex-col items-center justify-center gap-8 px-6 py-12 sm:p-12">
        <div className="w-full max-w-md">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.15em] text-teal-800 uppercase">
            Welcome to your workspace
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Let’s get to business.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Secure sign-in for Admin, Managers and Accounts. Use your registered mobile number to
            continue.
          </p>
        </div>
        <LoginForm next={next} />
        <p className="flex max-w-md items-center gap-2 text-center text-xs text-slate-500">
          <ShieldCheck className="size-4 shrink-0" />
          Access is based on your assigned role. Need access? Contact your KBS administrator.
        </p>
      </section>
    </main>
  );
}
