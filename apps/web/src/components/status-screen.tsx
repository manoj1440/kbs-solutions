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
      <div className="flex items-center gap-2.5 text-foreground">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-400 to-emerald-400 text-navy shadow-card">
          <Building2 className="size-5" />
        </span>
        <span className="text-lg font-bold tracking-tight">
          KBS<span className="font-normal text-muted-foreground"> Solutions</span>
        </span>
      </div>
      <div
        role={role}
        aria-live={role === 'status' ? 'polite' : undefined}
        className="grid w-full max-w-md justify-items-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-card"
      >
        {/* F-814: icon in flow, no tile container (the icon-tile-above-heading template) */}
        <span className={cn('relative inline-flex size-10 items-center justify-center', TONE[tone].text)}>
          {busy ? <span className="absolute -inset-1 animate-spin rounded-full border-2 border-transparent border-t-primary" aria-hidden="true" /> : null}
          <Icon className="size-8" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {children ? <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
        {footer ? <div className="mt-2 w-full border-t border-border-subtle pt-3 text-xs text-fg-3">{footer}</div> : null}
      </div>
    </main>
  );
}
