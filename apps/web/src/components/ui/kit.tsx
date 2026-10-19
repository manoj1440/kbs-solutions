import { ArrowLeft, ArrowUpRight, ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * F-806 web design kit. Server-safe (no hooks) so pages stay server components.
 * Rules: README.md next to this file. Presentation only — never reshape bank values.
 */

export type Tone = 'teal' | 'indigo' | 'sky' | 'violet' | 'amber' | 'rose' | 'emerald' | 'slate';

/**
 * F-817: the reference look is monochrome with one orange accent. Decorative tones share the neutral icon chip; only
 * their bar/dot colour differs (teal = the orange brand, indigo = black). emerald / amber / rose keep their meaning.
 */
const NEUTRAL_TILE = 'bg-surface-muted text-foreground ring-transparent';
export const TONE: Record<Tone, { tile: string; text: string; bar: string; soft: string }> = {
  teal: { tile: NEUTRAL_TILE, text: 'text-brand-strong', bar: 'bg-brand', soft: 'bg-brand-soft' },
  indigo: { tile: NEUTRAL_TILE, text: 'text-foreground', bar: 'bg-neutral-900', soft: 'bg-surface-muted' },
  sky: { tile: NEUTRAL_TILE, text: 'text-fg-2', bar: 'bg-neutral-500', soft: 'bg-surface-muted' },
  violet: { tile: NEUTRAL_TILE, text: 'text-fg-2', bar: 'bg-neutral-400', soft: 'bg-surface-muted' },
  amber: { tile: 'bg-amber-50 text-amber-700 ring-transparent', text: 'text-amber-700', bar: 'bg-amber-500', soft: 'bg-amber-50' },
  rose: { tile: 'bg-rose-50 text-rose-700 ring-transparent', text: 'text-rose-700', bar: 'bg-rose-500', soft: 'bg-rose-50' },
  emerald: { tile: 'bg-emerald-50 text-emerald-700 ring-transparent', text: 'text-emerald-700', bar: 'bg-emerald-500', soft: 'bg-emerald-50' },
  slate: { tile: NEUTRAL_TILE, text: 'text-fg-2', bar: 'bg-neutral-300', soft: 'bg-surface-muted' },
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
        'inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
        size === 'sm' ? 'size-8 [&>svg]:size-4' : size === 'lg' ? 'size-12 [&>svg]:size-6' : 'size-10 [&>svg]:size-5',
        TONE[tone].tile,
        className,
      )}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}

/** Every page starts with this: the page's single h1, purpose line, actions, optional KPI strip. F-814 U9: `eyebrow` is accepted but not rendered; F-817: `icon`/`tone` are accepted but not rendered (reference headers carry no icon). */
export function PageHeader({
  title,
  description,
  actions,
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
          <div className="min-w-0">
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-[32px] sm:leading-10">{title}</h1>
            {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
            {meta ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div> : null}
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
  delta,
  chart,
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
  /** F-814: change vs previous period, e.g. <DeltaBadge /> */
  delta?: React.ReactNode;
  /** F-814: recent history, e.g. <Sparkline /> */
  chart?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('text-ui font-medium', emphasis ? 'text-white/85' : 'text-fg-2')}>{label}</span>
        {icon ? (
          emphasis ? (
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/20 text-white [&>svg]:size-4">
              {React.createElement(icon, { 'aria-hidden': true })}
            </span>
          ) : (
            <IconTile icon={icon} tone={tone} size="sm" className="bg-surface-muted text-fg-2" />
          )
        ) : null}
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="truncate text-[28px] leading-9 font-semibold tracking-tight tabular-nums sm:text-[32px] sm:leading-10">{value}</span>
        {delta}
      </div>
      {hint ? <p className={cn('mt-1 text-xs leading-relaxed', emphasis ? 'text-white/85' : 'text-muted-foreground')}>{hint}</p> : null}
      {chart ? <div className="mt-3">{chart}</div> : null}
      {source || href ? (
        <div
          className={cn(
            'mt-4 flex items-center justify-between gap-2 border-t pt-3 text-2xs font-medium',
            emphasis ? 'border-white/20 text-white/85' : 'border-border-subtle text-fg-3',
          )}
        >
          <span className="truncate">{source}</span>
          {href ? <ArrowUpRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /> : null}
        </div>
      ) : null}
    </>
  );
  const cls = cn(
    'group relative min-w-0 overflow-hidden rounded-2xl border border-transparent p-4 sm:p-5',
    emphasis ? 'brand-gradient text-white shadow-pop' : 'bg-card shadow-card',
    href && 'lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
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

/** Card with a proper header row (title, description, actions). Use instead of bare Card+CardHeader. F-817: `icon`/`tone` accepted, not rendered. */
export function SectionCard({
  title,
  description,
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
        'min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border border-transparent bg-card shadow-card',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-base leading-6 font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
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
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface-muted px-6 py-10 text-center', className)}>
      <span className="mb-1 inline-flex size-12 items-center justify-center rounded-full bg-card text-fg-3 shadow-card">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** F-808 compact KPI for dense workspaces: label, value and one short line; `href` makes it a filter link, `active` marks the applied one. */
export function MiniStat({
  label,
  value,
  hint,
  href,
  tone = 'slate',
  active,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: Tone;
  active?: boolean;
}) {
  const body = (
    <>
      <span className="flex items-start gap-1.5 text-2xs leading-tight font-medium text-fg-2">
        <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', TONE[tone].bar)} aria-hidden="true" />
        {label}
      </span>
      <span className="mt-0.5 block text-xl leading-7 font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
      {hint ? <span className="line-clamp-2 block text-2xs leading-snug text-muted-foreground">{hint}</span> : null}
    </>
  );
  const cls = cn(
    // F-817: white on the canvas, soft grey when it sits inside a card (reference inner tiles)
    'block min-w-0 rounded-2xl border bg-card px-3.5 py-2.5 shadow-card in-data-[slot=card]:bg-surface-muted in-data-[slot=card]:shadow-none',
    active ? 'border-foreground ring-1 ring-foreground' : 'border-transparent',
    href && 'transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  );
  return href ? (
    <Link href={href} prefetch={false} title={hint} aria-current={active ? 'true' : undefined} className={cls}>
      {body}
    </Link>
  ) : (
    <div title={hint} className={cls}>
      {body}
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
      <div className="inline-flex min-w-max gap-1 rounded-full bg-card p-1 shadow-card">
        {items.map(({ href, label: text, count, icon: Icon }) => {
          const on = href === active;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-ui font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                on ? 'bg-foreground text-background shadow-sm' : 'text-fg-2 hover:bg-muted hover:text-foreground',
              )}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
              {text}
              {count != null ? (
                <span className={cn('rounded-full px-1.5 text-2xs font-semibold tabular-nums', on ? 'bg-background/20 text-background' : 'bg-muted text-fg-2')}>
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
  'bg-neutral-200 text-neutral-950',
  'bg-neutral-200 text-neutral-950',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-sky-100 text-sky-800',
  'bg-neutral-200 text-neutral-950',
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
        size === 'sm' ? 'size-7 text-2xs' : size === 'lg' ? 'size-14 text-lg' : 'size-9 text-xs',
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
        size === 'sm' ? 'h-7 min-w-7 px-1 text-[8.5px]' : 'h-10 min-w-10 px-1.5 text-2xs',
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
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
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
          <dt className="text-2xs font-medium text-muted-foreground">{k}</dt>
          <dd className="mt-1 text-sm break-words text-foreground">{v}</dd>
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
  neutral: 'border-transparent bg-surface-muted text-fg-2 [&_svg]:text-muted-foreground',
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
    <div role={role} className={cn('flex gap-3 rounded-2xl border px-4 py-3 text-sm', CALLOUT[tone], className)}>
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'text-ui opacity-90')}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Small status dot + text, for KBS states (user status, job health). */
export function StatusDot({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-2">
      <span className={cn('size-2 rounded-full ring-2 ring-card', TONE[tone].bar)} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Label + control stack for filter bars and forms. */
export function Field({ label, htmlFor, hint, children, className }: { label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-2">
        {label}
      </label>
      {children}
      {hint ? <p className="text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** The class a native <select> should carry to match Input. */
export const selectClass = 'h-10 w-full min-w-0 rounded-full border border-input bg-card px-4 text-sm text-foreground';

/** F-814 detail-page identity (U14): back link, visual, the page's single h1, subtitle, meta chips, actions, optional summary strip. No eyebrow. */
export function DetailHeader({
  back,
  visual,
  title,
  subtitle,
  meta,
  actions,
  children,
}: {
  back?: { href: string; label: string };
  visual?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="grid gap-4">
      {back ? (
        <Link href={back.href} prefetch={false} className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {visual}
          <div className="min-w-0">
            <h1 className="text-2xl font-medium tracking-tight text-balance text-foreground sm:text-[32px] sm:leading-10">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div> : null}
      {children}
    </header>
  );
}

/** F-814 right-rail card (Today / agenda): count in the title, short linked rows, one footer link. */
export function RailCard({
  title,
  icon,
  count,
  items,
  empty,
  footer,
}: {
  title: string;
  icon?: LucideIcon;
  tone?: Tone;
  count?: number | null;
  items: { key: string; href?: string; title: React.ReactNode; meta?: React.ReactNode; aside?: React.ReactNode }[];
  empty: string;
  footer?: { href: string; label: string };
}) {
  return (
    <section className="rounded-2xl bg-card shadow-card">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        {icon ? <IconTile icon={icon} tone="slate" size="sm" /> : null}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h2>
        {count != null ? <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', count ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>{count}</span> : null}
      </div>
      {items.length ? (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {items.map((it) => {
            const row = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-medium text-foreground">{it.title}</span>
                  {it.meta ? <span className="block truncate text-xs text-muted-foreground">{it.meta}</span> : null}
                </span>
                {it.aside ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{it.aside}</span> : null}
                {it.href ? <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden="true" /> : null}
              </>
            );
            return (
              <li key={it.key}>
                {it.href ? (
                  <Link href={it.href} prefetch={false} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-t border-border-subtle px-4 py-4 text-xs text-muted-foreground">{empty}</p>
      )}
      {footer ? (
        <Link href={footer.href} prefetch={false} className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted">
          {footer.label}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}

const STRIP_COLS = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 xl:grid-cols-5', 6: 'sm:grid-cols-3 xl:grid-cols-6', 8: 'sm:grid-cols-4 xl:grid-cols-8' } as const;

/**
 * F-814 U12: KPI tiles (`MiniStat`s) — a grid from `sm`, a swipeable single row on phones so the first screen shows the
 * task, not six tiles. Every tile stays in the DOM (no hidden figures).
 */
export function StatStrip({ cols = 6, className, children }: { cols?: keyof typeof STRIP_COLS; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex shrink-0 snap-x gap-2 overflow-x-auto pb-1 max-sm:-mx-4 max-sm:px-4 max-sm:[&>*]:w-40 max-sm:[&>*]:shrink-0 max-sm:[&>*]:snap-start sm:grid sm:overflow-visible sm:pb-0',
        STRIP_COLS[cols],
        className,
      )}
    >
      {children}
    </div>
  );
}
