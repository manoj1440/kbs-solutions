'use client';

import type { MeResponse } from '@kbs/shared';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  PhoneCall,
  PieChart,
  RefreshCw,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { NotificationBell } from '@/components/notification-bell';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { LogoutButton } from '@/components/logout-button';
import { SessionKeepAlive } from '@/components/session-keep-alive';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';
import { Avatar, humanize } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

type NavGroup = {
  label: string;
  items: { href: string; label: string; icon: LucideIcon; also?: string[] }[];
};
export type WorkspaceArea = 'admin' | 'manager' | 'accounts';

// F-807: one group = one responsibility; every page appears once (payment exceptions is a tab of Payout requests).
const ADMIN_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Business overview', icon: LayoutDashboard }],
  },
  {
    label: 'Sales',
    items: [
      { href: '/admin/leads', label: 'Leads & applications', icon: ListChecks },
      { href: '/admin/mis', label: 'Bank MIS upload', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Calling',
    items: [
      { href: '/admin/calling-list', label: 'Calling records', icon: Phone },
      { href: '/admin/calling-list/performance', label: 'Caller performance', icon: BarChart3 },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users & teams', icon: Users },
      { href: '/admin/onboarding', label: 'Advisor approvals', icon: ClipboardCheck },
      { href: '/admin/training', label: 'Training content', icon: GraduationCap },
      { href: '/admin/training/team', label: 'Training progress', icon: BookOpenCheck },
    ],
  },
  {
    label: 'Products',
    items: [
      { href: '/admin/catalogue', label: 'Card catalogue', icon: CreditCard },
      { href: '/admin/pincode-profiles', label: 'Bank coverage', icon: MapPin },
    ],
  },
  {
    label: 'Payouts',
    items: [
      { href: '/admin/payouts/requests', label: 'Payout requests', icon: Wallet },
      { href: '/admin/payouts/entitlements', label: 'Entitlement ledger', icon: ListChecks },
      { href: '/admin/payouts/liability', label: 'Payout liability', icon: Scale },
      { href: '/admin/payouts/rules', label: 'Payout rules', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        href: '/admin/dashboards/telecallers',
        label: 'Team performance',
        icon: Users,
        also: ['/admin/dashboards/managers', '/admin/dashboards/advisors'],
      },
      { href: '/admin/dashboards/bank-card-mix', label: 'Bank / card mix', icon: PieChart },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/config', label: 'Configuration', icon: Settings2 },
      { href: '/admin/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/admin/network', label: 'Office network', icon: Wifi },
      { href: '/admin/retention', label: 'Retention & legal hold', icon: Archive },
      { href: '/admin/audit', label: 'Audit trail', icon: History },
    ],
  },
];
const MANAGER_GROUPS: NavGroup[] = [
  {
    label: 'Team',
    items: [
      { href: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      // a Telecaller's page belongs to the team (Create Telecaller still wins on /new: longer match)
      { href: '/manager', label: 'Team', icon: Users, also: ['/manager/telecallers'] },
      { href: '/manager/calling', label: 'Team calling', icon: PhoneCall },
      { href: '/manager/advisors', label: 'Advisors', icon: UserRound },
      { href: '/manager/telecallers/new', label: 'Create Telecaller', icon: UserPlus },
    ],
  },
  {
    label: 'Leads',
    items: [
      { href: '/manager/leads', label: 'Team leads', icon: ListChecks },
      { href: '/manager/pending-actions', label: 'Pending actions', icon: ClipboardList },
    ],
  },
  {
    label: 'Payouts',
    items: [
      { href: '/manager/payouts', label: 'Team payouts', icon: Wallet },
      { href: '/manager/payouts/requests', label: 'Payout approvals', icon: BadgeCheck },
      { href: '/manager/payouts/liability', label: 'Payout liability', icon: Scale },
    ],
  },
];

const ACCOUNTS_GROUPS: NavGroup[] = [
  {
    label: 'Payments',
    items: [
      { href: '/accounts?queue=awaiting', label: 'Awaiting payment', icon: Clock3 },
      { href: '/accounts?queue=paid', label: 'Paid', icon: CheckCircle2 },
      { href: '/accounts?queue=exceptions', label: 'Exceptions', icon: AlertTriangle },
    ],
  },
  {
    label: 'Reports',
    items: [{ href: '/accounts/reconciliation', label: 'Reconciliation', icon: Scale }],
  },
];

const AREA: Record<WorkspaceArea, { home: string; subtitle: string; groups: NavGroup[] }> = {
  admin: { home: '/admin', subtitle: 'Business workspace', groups: ADMIN_GROUPS },
  manager: { home: '/manager', subtitle: 'Manager workspace', groups: MANAGER_GROUPS },
  accounts: { home: '/accounts', subtitle: 'Accounts workspace', groups: ACCOUNTS_GROUPS },
};

/** Does `href` (optionally with a query) describe the current location? Returns the match length for ranking. */
function matchLength(href: string, pathname: string, params: URLSearchParams, root: string) {
  const [path, query] = href.split('?');
  if (query) {
    if (pathname !== path) return 0;
    for (const [k, v] of new URLSearchParams(query)) if (params.get(k) !== v) return 0;
    return href.length;
  }
  return pathname === path || (path !== root && pathname.startsWith(`${path}/`)) ? path.length : 0;
}

/**
 * F-801 / F-806 / F-817 workspace shell for every web area (Admin, Manager, Accounts): one left sidebar with every
 * section and page (icons only, or icons + labels when expanded), a floating top bar (section › page, search /
 * notifications / refresh, account menu), the drawer below `md`, and keyboard page search.
 */
export function WorkspaceShell({
  session,
  area,
  navExpanded = false,
  children,
}: {
  session: MeResponse;
  area: WorkspaceArea;
  /** F-817: sidebar shows labels (from the `kbs_nav` cookie, read by the layout so the first paint matches) */
  navExpanded?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  // the viewer's own area owns their account pages and notifications (an Admin visiting /manager keeps /admin ones)
  const own: WorkspaceArea = session.user.role === 'ACCOUNTS' ? 'accounts' : session.user.role === 'ADMIN' ? 'admin' : 'manager';
  const accountBase = AREA[own].home;
  const roleLabel = session.user.role === 'ADMIN' ? 'Administrator' : humanize(session.user.role);
  const { home, subtitle } = AREA[area];
  const you: NavGroup = {
    label: 'You',
    items: [
      { href: `${accountBase}/notifications`, label: 'Notifications', icon: Bell },
      { href: `${accountBase}/account`, label: 'Account & support', icon: UserRound },
    ],
  };
  // Admin reaches "You" pages from the bell / avatar menu only; they stay in ITEMS for breadcrumb and search
  const GROUPS: NavGroup[] = area === 'admin' ? AREA.admin.groups : [...AREA[area].groups, you];
  const ITEMS = [...GROUPS, ...(area === 'admin' ? [you] : [])].flatMap((g) =>
    g.items.map((i) => ({ ...i, group: g.label })),
  );
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const search = useRef<HTMLDialogElement>(null);
  const mobileNav = useRef<HTMLDialogElement>(null);
  const active =
    ITEMS.map((n) => ({
      n,
      len: Math.max(
        0,
        ...[n.href, ...(n.also ?? [])].map((h) => matchLength(h, pathname, params, home)),
      ),
    }))
      .filter((m) => m.len > 0)
      .sort((a, b) => b.len - a.len)[0]?.n ?? ITEMS[0];
  const name = session.user.fullName || session.user.mobileMasked;
  const q = query.trim().toLowerCase();
  const matches = ITEMS.filter(
    (n) => n.label.toLowerCase().includes(q) || n.group.toLowerCase().includes(q),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        search.current?.showModal();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function go(href: string) {
    search.current?.close();
    setQuery('');
    setCursor(0);
    router.push(href);
  }

  // F-817: every section lives in the left sidebar — icons only, or icons + labels when expanded (remembered per viewer)
  const [expanded, setExpanded] = useState(navExpanded);
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  function toggleNav() {
    const next = !expanded;
    setExpanded(next);
    setTip(null);
    document.cookie = `kbs_nav=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  }
  function showTip(e: React.SyntheticEvent<HTMLElement>, label: string) {
    if (expanded) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 12 });
  }

  async function signOut() {
    await clientApi.post('/auth/logout').catch(() => undefined);
    router.replace('/login?reason=signed-out');
    router.refresh();
  }

  /** Drawer (below `md`): every section with its pages, labelled. */
  function drawerNavigation() {
    return GROUPS.map((group) => (
      <div key={group.label} className="mb-5">
        <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
        <div className="grid gap-0.5">
          {group.items.map(({ href, label, icon: Icon }) => {
            const on = active.href === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => mobileNav.current?.close()}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded-full px-3 py-2 text-ui font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  on ? 'bg-foreground text-background' : 'text-fg-2 hover:bg-surface-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    ));
  }

  const pill = 'rounded-full bg-card shadow-card';
  const iconButton = 'inline-flex size-10 items-center justify-center rounded-full text-fg-2 transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60';
  const navItem = (on: boolean) =>
    cn(
      'flex items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      expanded ? 'h-10 w-full gap-3 px-3' : 'mx-auto size-11 justify-center',
      on ? 'bg-foreground text-background' : 'text-fg-2 hover:bg-surface-muted hover:text-foreground',
    );

  const logo = (
    <span className="brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" aria-hidden="true">
      K
    </span>
  );

  return (
    <div className="admin-workspace admin-canvas flex min-h-screen text-foreground">
      <a href="#admin-content" className="sr-only fixed top-2 left-2 z-50 rounded-lg bg-card p-3 text-sm focus:not-sr-only">
        Skip to content
      </a>
      <aside className={cn('sticky top-0 z-30 hidden h-dvh shrink-0 py-4 pl-4 transition-[width] duration-200 md:block', expanded ? 'w-[272px]' : 'w-[92px]')}>
        <div className="flex h-full flex-col rounded-[28px] bg-card shadow-card">
          <div className={cn('flex shrink-0 gap-2 p-3', expanded ? 'items-center justify-between' : 'flex-col items-center')}>
            <Link href={home} prefetch={false} aria-label={`KBS Solutions — ${subtitle}`} className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-ring">
              {logo}
              {expanded ? (
                <span className="min-w-0">
                  <span className="block truncate text-[15px] leading-5 font-semibold tracking-tight">
                    KBS<span className="font-normal text-fg-3"> Solutions</span>
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">{subtitle}</span>
                </span>
              ) : null}
            </Link>
            <button type="button" onClick={toggleNav} aria-expanded={expanded} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'} title={expanded ? 'Collapse' : 'Expand'} className={cn(iconButton, 'size-9 shrink-0 bg-surface-muted')}>
              {expanded ? <PanelLeftClose className="size-[18px]" /> : <PanelLeftOpen className="size-[18px]" />}
            </button>
          </div>
          <nav aria-label={`${humanize(area)} navigation`} className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3" onScroll={() => setTip(null)}>
            {GROUPS.map((group, gi) => (
              <div key={group.label} className={cn(gi > 0 && (expanded ? 'mt-4' : 'mt-2 border-t border-border-subtle pt-2'))}>
                {expanded ? <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p> : <p className="sr-only">{group.label}</p>}
                <div className="grid gap-1">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const on = active.href === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        prefetch={false}
                        aria-current={on ? 'page' : undefined}
                        aria-label={expanded ? undefined : label}
                        onMouseEnter={(e) => showTip(e, label)}
                        onMouseLeave={() => setTip(null)}
                        onFocus={(e) => showTip(e, label)}
                        onBlur={() => setTip(null)}
                        className={navItem(on)}
                      >
                        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                        {expanded ? <span className="truncate text-ui font-medium">{label}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="grid shrink-0 gap-1 border-t border-border-subtle p-2.5">
            <Link
              href={`${accountBase}/account`}
              prefetch={false}
              aria-label={expanded ? undefined : 'Account & support'}
              onMouseEnter={(e) => showTip(e, 'Account & support')}
              onMouseLeave={() => setTip(null)}
              onFocus={(e) => showTip(e, 'Account & support')}
              onBlur={() => setTip(null)}
              className={navItem(active.href === `${accountBase}/account`)}
            >
              <CircleHelp className="size-[18px] shrink-0" aria-hidden="true" />
              {expanded ? <span className="truncate text-ui font-medium">Account & support</span> : null}
            </Link>
            <button
              type="button"
              aria-label={expanded ? undefined : 'Sign out'}
              onMouseEnter={(e) => showTip(e, 'Sign out')}
              onMouseLeave={() => setTip(null)}
              onFocus={(e) => showTip(e, 'Sign out')}
              onBlur={() => setTip(null)}
              onClick={() => void signOut()}
              className={navItem(false)}
            >
              <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
              {expanded ? <span className="truncate text-ui font-medium">Sign out</span> : null}
            </button>
          </div>
        </div>
      </aside>
      {tip ? (
        <div role="tooltip" className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium whitespace-nowrap text-background shadow-pop" style={{ top: tip.top, left: tip.left }}>
          {tip.label}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-4 sm:h-[76px] sm:gap-3 sm:px-6">
            <button type="button" aria-label="Open navigation" className={cn(pill, 'inline-flex size-11 shrink-0 items-center justify-center text-fg-2 hover:text-foreground md:hidden')} onClick={() => mobileNav.current?.showModal()}>
              <Menu className="size-5" />
            </button>
            <Link href={home} prefetch={false} aria-label={`KBS Solutions — ${subtitle}`} className={cn(pill, 'flex h-11 shrink-0 items-center gap-2 pr-4 pl-1 md:hidden')}>
              {logo}
              <span className="text-[15px] font-semibold tracking-tight">KBS</span>
            </Link>
            <div className={cn(pill, 'hidden h-11 min-w-0 items-center gap-2 px-4 md:flex')}>
              <span className="text-ui text-muted-foreground">{active.group}</span>
              <ChevronRight className="size-3.5 shrink-0 text-fg-3" aria-hidden="true" />
              <span className="flex min-w-0 items-center gap-2 text-ui font-semibold text-foreground">
                <active.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{active.label}</span>
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className={cn(pill, 'flex h-11 items-center gap-0.5 px-0.5')}>
                <button type="button" className={iconButton} aria-label="Search workspace" title="Search (⌘K)" onClick={() => search.current?.showModal()}>
                  <Search className="size-[18px]" />
                </button>
                <NotificationBell area={own} />
                <button type="button" className={cn(iconButton, 'hidden sm:inline-flex')} aria-label="Refresh business data" title="Refresh data" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
                  <RefreshCw className={cn('size-[18px]', refreshing && 'animate-spin')} />
                </button>
              </div>
              <details className="relative">
                <summary className={cn(pill, 'flex h-11 cursor-pointer list-none items-center gap-2 p-1 focus-visible:outline-2 focus-visible:outline-ring sm:pr-3 [&::-webkit-details-marker]:hidden')} aria-label="Account menu">
                  <Avatar name={name} className="bg-foreground text-background" />
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-36 truncate text-ui leading-4 font-semibold">{name}</span>
                    <span className="block text-2xs leading-4 text-muted-foreground">{roleLabel}</span>
                  </span>
                  <ChevronDown className="hidden size-4 text-fg-3 sm:block" aria-hidden="true" />
                </summary>
                <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl bg-card shadow-pop">
                  <div className="flex items-center gap-3 bg-surface-muted px-4 py-3">
                    <Avatar name={name} className="bg-foreground text-background" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">{session.user.mobileMasked}</p>
                    </div>
                  </div>
                  <div className="grid p-1.5">
                    <Link href={`${accountBase}/account`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg-2 hover:bg-surface-muted">
                      <UserRound className="size-4 text-fg-3" /> Account & support
                    </Link>
                    <Link href={`${accountBase}/notifications`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg-2 hover:bg-surface-muted">
                      <Bell className="size-4 text-fg-3" /> All notifications
                    </Link>
                  </div>
                  <div className="border-t border-border-subtle p-3">
                    <LogoutButton />
                  </div>
                </div>
              </details>
            </div>
          </div>
        </header>
        <SessionKeepAlive accessExpiresInSec={session.account?.accessExpiresInSec ?? 900} />
        <main id="admin-content" tabIndex={-1} className="admin-content mx-auto w-full max-w-[1600px] min-w-0 px-4 pt-1 pb-10 outline-none sm:px-6">
          {children}
        </main>
      </div>
      <dialog
        ref={mobileNav}
        aria-label={`${humanize(area)} navigation menu`}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] rounded-r-[28px] bg-card p-0 text-foreground shadow-pop backdrop:bg-stone-950/40 backdrop:backdrop-blur-sm open:flex open:flex-col"
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-4">
          <Link href={home} prefetch={false} className="flex items-center gap-2.5" onClick={() => mobileNav.current?.close()}>
            {logo}
            <span className="text-[15px] font-semibold tracking-tight">
              KBS<span className="font-normal text-fg-3"> Solutions</span>
            </span>
          </Link>
          <button type="button" aria-label="Close navigation" className={iconButton} onClick={() => mobileNav.current?.close()}>
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label={`Mobile ${area} navigation`} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {drawerNavigation()}
        </nav>
        <div className="flex shrink-0 items-center gap-3 border-t border-border-subtle px-4 py-3">
          <Avatar name={name} className="bg-foreground text-background" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui font-semibold">{name}</span>
            <span className="block text-2xs text-muted-foreground">{roleLabel}</span>
          </span>
          <button type="button" aria-label="Sign out" title="Sign out" className={iconButton} onClick={() => void signOut()}>
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </dialog>
      <dialog
        ref={search}
        aria-labelledby="workspace-search-title"
        onClose={() => {
          setQuery('');
          setCursor(0);
        }}
        className="fixed inset-x-0 top-[12vh] mx-auto w-[min(600px,calc(100%-32px))] max-w-none overflow-hidden rounded-[28px] bg-card p-0 shadow-pop backdrop:bg-stone-950/40 backdrop:backdrop-blur-sm"
      >
        <h2 id="workspace-search-title" className="sr-only">
          Find your workspace
        </h2>
        <div className="flex items-center gap-3 border-b border-border-subtle px-4">
          <Search className="size-5 text-fg-3" />
          <input
            autoFocus
            aria-label="Search pages"
            placeholder="Search pages — leads, payouts, training…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, matches.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === 'Enter' && matches[cursor]) {
                e.preventDefault();
                go(matches[cursor].href);
              }
            }}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close search"
            onClick={() => search.current?.close()}
          >
            <X />
          </Button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {matches.map(({ href, label, group, icon: Icon }, i) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onMouseEnter={() => setCursor(i)}
              onClick={() => {
                search.current?.close();
              }}
              data-active={i === cursor || undefined}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg-2 data-[active]:bg-surface-muted data-[active]:text-foreground"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-fg-2">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="text-2xs text-fg-3">{group}</span>
              </span>
              <ArrowRight className="size-4 text-fg-3" />
            </Link>
          ))}
          {matches.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No workspace matches. Try “leads” or “payout”.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-4 border-t border-border-subtle bg-surface-muted px-4 py-2 text-2xs text-muted-foreground">
          <span>
            <kbd className="rounded border bg-card px-1">↑</kbd>{' '}
            <kbd className="rounded border bg-card px-1">↓</kbd> to move
          </span>
          <span>
            <kbd className="rounded border bg-card px-1">Enter</kbd> to open
          </span>
          <span>
            <kbd className="rounded border bg-card px-1">Esc</kbd> to close
          </span>
        </div>
      </dialog>
    </div>
  );
}
