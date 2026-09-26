import { Building2, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { type Tone, TONE } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

/** F-806: branded full-page state (not found, access, errors, session hop, public ID check). Server-safe. */
export function StatusScreen({
  icon: Icon,
  tone = 'teal',
  title,
  children,
  actions,
  footer,
  role,
  busy,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  role?: 'alert' | 'status';
  /** spin the icon ring (in-progress states) */
  busy?: boolean;
}) {
  return (
    <main className="admin-canvas flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <div className="flex items-center gap-2.5 text-slate-800">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-300 to-emerald-400 text-[#0b1a2e] shadow-[0_6px_20px_-6px_rgb(45_212_191/70%)]">
          <Building2 className="size-5" />
        </span>
        <span className="text-lg font-bold tracking-tight">
          KBS<span className="font-normal text-slate-500"> Solutions</span>
        </span>
      </div>
      <div
        role={role}
        aria-live={role === 'status' ? 'polite' : undefined}
        className="grid w-full max-w-md justify-items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-6 py-8 text-center shadow-[0_1px_2px_rgb(15_23_42/4%),0_20px_50px_-24px_rgb(15_23_42/25%)]"
      >
        <span className={cn('relative mb-1 inline-flex size-14 items-center justify-center rounded-2xl ring-1 ring-inset', TONE[tone].tile)}>
          {busy ? <span className="absolute -inset-1.5 animate-spin rounded-[20px] border-2 border-transparent border-t-teal-500" aria-hidden="true" /> : null}
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {children ? <div className="grid gap-2 text-sm leading-relaxed text-slate-500">{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
        {footer ? <div className="mt-2 w-full border-t border-slate-100 pt-3 text-xs text-slate-400">{footer}</div> : null}
      </div>
    </main>
  );
}
