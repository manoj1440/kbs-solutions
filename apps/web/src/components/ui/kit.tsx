import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * F-806 web design kit. Server-safe (no hooks) so pages stay server components.
 * Rules: README.md next to this file. Presentation only — never reshape bank values.
 */

export type Tone = 'teal' | 'indigo' | 'sky' | 'violet' | 'amber' | 'rose' | 'emerald' | 'slate';

export const TONE: Record<Tone, { tile: string; text: string; bar: string; soft: string }> = {
  teal: { tile: 'bg-teal-50 text-teal-700 ring-teal-100', text: 'text-teal-700', bar: 'bg-teal-600', soft: 'bg-teal-50' },
  indigo: { tile: 'bg-indigo-50 text-indigo-700 ring-indigo-100', text: 'text-indigo-700', bar: 'bg-indigo-500', soft: 'bg-indigo-50' },
  sky: { tile: 'bg-sky-50 text-sky-700 ring-sky-100', text: 'text-sky-700', bar: 'bg-sky-500', soft: 'bg-sky-50' },
  violet: { tile: 'bg-violet-50 text-violet-700 ring-violet-100', text: 'text-violet-700', bar: 'bg-violet-500', soft: 'bg-violet-50' },
  amber: { tile: 'bg-amber-50 text-amber-700 ring-amber-100', text: 'text-amber-700', bar: 'bg-amber-500', soft: 'bg-amber-50' },
  rose: { tile: 'bg-rose-50 text-rose-700 ring-rose-100', text: 'text-rose-700', bar: 'bg-rose-500', soft: 'bg-rose-50' },
  emerald: { tile: 'bg-emerald-50 text-emerald-700 ring-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500', soft: 'bg-emerald-50' },
  slate: { tile: 'bg-slate-100 text-slate-600 ring-slate-200', text: 'text-slate-600', bar: 'bg-slate-400', soft: 'bg-slate-50' },
};

/** KBS enum constant → sentence case (`PENDING_ONBOARDING` → "Pending onboarding"). Never use on bank MIS values. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function IconTile({ icon: Icon, tone = 'teal', size = 'md', className }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
        size === 'sm' ? 'size-8 [&>svg]:size-4' : size === 'lg' ? 'size-12 [&>svg]:size-6' : 'size-10 [&>svg]:size-5',
        TONE[tone].tile,
        className,
      )}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}

/** Every page starts with this: icon tile, section eyebrow, the page's single h1, purpose line, actions, optional KPI strip. */
export function PageHeader({
  icon,
  eyebrow,
  title,
  description,
  actions,
  tone = 'teal',
  meta,
  children,
}: {
  icon?: LucideIcon;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: Tone;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {icon ? <IconTile icon={icon} tone={tone} size="lg" className="hidden shadow-sm sm:inline-flex" /> : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className={cn('mb-1 text-[10.5px] font-semibold tracking-[0.16em] uppercase', TONE[tone].text)}>{eyebrow}</div>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px] sm:leading-9">{title}</h1>
            {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
            {meta ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4', className)}>{children}</div>;
}

/** KPI tile: value first, label and source second. `href` makes the whole tile a link. */
export function StatCard({
  label,
  value,
  hint,
  source,
  icon,
  tone = 'teal',
  href,
  emphasis,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  source?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
  emphasis?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('text-[12.5px] font-medium', emphasis ? 'text-teal-50' : 'text-slate-600')}>{label}</span>
        {icon ? (
          emphasis ? (
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20 [&>svg]:size-[18px]">
              {React.createElement(icon, { 'aria-hidden': true })}
            </span>
          ) : (
            <IconTile icon={icon} tone={tone} size="sm" className="size-8 sm:size-9" />
          )
        ) : null}
      </div>
      <div className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px] sm:leading-9">{value}</div>
      {hint ? <p className={cn('mt-1 text-xs leading-relaxed', emphasis ? 'text-teal-50/90' : 'text-slate-500')}>{hint}</p> : null}
      {source || href ? (
        <div
          className={cn(
            'mt-4 flex items-center justify-between gap-2 border-t pt-3 text-[10px] font-semibold tracking-wider uppercase',
            emphasis ? 'border-white/15 text-teal-50/90' : 'border-slate-100 text-slate-400',
          )}
        >
          <span className="truncate">{source}</span>
          {href ? <ArrowUpRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /> : null}
        </div>
      ) : null}
    </>
  );
  const cls = cn(
    'group relative min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5',
    emphasis
      ? 'border-transparent bg-[linear-gradient(135deg,#0f766e_0%,#115e59_55%,#134e4a_100%)] text-white shadow-[0_12px_30px_-14px_rgb(15_118_110/70%)]'
      : 'border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]',
    href && 'lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700',
    className,
  );
  return href ? (
    <Link href={href} prefetch={false} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Card with a proper header row (icon, title, description, actions). Use instead of bare Card+CardHeader. */
export function SectionCard({
  title,
  description,
  icon,
  tone = 'slate',
  actions,
  children,
  className,
  bodyClassName,
  id,
  flush,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  /** body touches the card edges (tables) */
  flush?: boolean;
}) {
  return (
    <section
      id={id}
      data-slot="card"
      className={cn(
        'min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null}
          <div className="min-w-0">
            <h2 className="text-[15px] leading-6 font-semibold tracking-tight text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children != null ? (
        <div className={cn(flush ? '[&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-x-0 [&_[data-slot=table-container]]:border-b-0' : 'px-5 pb-5 sm:px-6 sm:pb-6', bodyClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center', className)}>
      <span className="mb-1 inline-flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Segmented link navigation (tabs, queues). Server-safe: the caller passes the active href. */
export function PillNav({
  items,
  active,
  label,
  className,
}: {
  items: { href: string; label: React.ReactNode; count?: number | null; icon?: LucideIcon }[];
  active: string;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn('-mx-1 overflow-x-auto px-1 pb-1', className)}>
      <div className="inline-flex min-w-max gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        {items.map(({ href, label: text, count, icon: Icon }) => {
          const on = href === active;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-teal-700',
                on ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
              {text}
              {count != null ? (
                <span className={cn('rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums', on ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600')}>
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const AVATAR_TONES = [
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-emerald-100 text-emerald-800',
];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
export function initials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

export function Avatar({ name, size = 'md', className }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'size-7 text-[10px]' : size === 'lg' ? 'size-14 text-lg' : 'size-9 text-xs',
        AVATAR_TONES[hash(name ?? '') % AVATAR_TONES.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Bank identity: deterministic gradient per bank code (brand-neutral — not the banks' logos). */
export const BANK_GRADIENTS = [
  'from-[#0b3d91] to-[#1e63d6]',
  'from-[#7a1034] to-[#c2185b]',
  'from-[#0f5132] to-[#15803d]',
  'from-[#4c1d95] to-[#7c3aed]',
  'from-[#9a3412] to-[#ea580c]',
  'from-[#134e4a] to-[#0d9488]',
  'from-[#1e293b] to-[#475569]',
  'from-[#831843] to-[#db2777]',
];
export const bankGradient = (code: string) => BANK_GRADIENTS[hash(code) % BANK_GRADIENTS.length];

export function BankMark({ code, size = 'md', className }: { code: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-bold tracking-tight text-white shadow-sm',
        size === 'sm' ? 'h-7 min-w-7 px-1 text-[8.5px]' : 'h-10 min-w-10 px-1.5 text-[10px]',
        bankGradient(code),
        className,
      )}
    >
      {code.slice(0, 5)}
    </span>
  );
}

export function Meter({ value, max, tone = 'teal', className, label }: { value: number; max: number; tone?: Tone; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', TONE[tone].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Label/value pairs in a responsive grid. */
export function KeyValueGrid({ items, className, cols = 2 }: { items: [React.ReactNode, React.ReactNode][]; className?: string; cols?: 2 | 3 | 4 }) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{k}</dt>
          <dd className="mt-1 text-sm break-words text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const CALLOUT = {
  info: 'border-sky-200 bg-sky-50 text-sky-900 [&_svg]:text-sky-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 [&_svg]:text-amber-600',
  danger: 'border-rose-200 bg-rose-50 text-rose-900 [&_svg]:text-rose-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 [&_svg]:text-emerald-600',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700 [&_svg]:text-slate-500',
};
export function Callout({
  tone = 'info',
  icon: Icon,
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof CALLOUT;
  icon?: LucideIcon;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}) {
  return (
    <div role={role} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', CALLOUT[tone], className)}>
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'text-[13px] opacity-90')}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Small status dot + text, for KBS states (user status, job health). */
export function StatusDot({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
      <span className={cn('size-2 rounded-full ring-2 ring-white', TONE[tone].bar)} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Label + control stack for filter bars and forms. */
export function Field({ label, htmlFor, hint, children, className }: { label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-slate-600">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** The class a native <select> should carry to match Input. */
export const selectClass = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900';
