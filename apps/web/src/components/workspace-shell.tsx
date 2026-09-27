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
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Menu,
  Phone,
  PhoneCall,
  PieChart,
  RefreshCw,
  Scale,
  ScanSearch,
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
    items: [{ href: '/admin/leads', label: 'Leads & applications', icon: ListChecks }],
  },
  {
    label: 'Calling',
    items: [
      { href: '/admin/calling-list', label: 'Calling records', icon: Phone },
      {
        href: '/admin/calling-list/performance',
        label: 'Caller performance',
        icon: BarChart3,
        also: ['/admin/calling-list/oversight'],
      },
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
    label: 'Bank MIS',
    items: [
      { href: '/admin/mis', label: 'MIS imports', icon: FileSpreadsheet },
      { href: '/admin/mis/integrity', label: 'Data integrity', icon: ScanSearch },
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
 * F-801 / F-806 workspace shell for every web area (Admin, Manager, Accounts): gradient sidebar grouped by area,
 * group › page breadcrumb, keyboard page search, notifications, refresh and the account menu.
 */
export function WorkspaceShell({
  session,
  area,
  children,
}: {
  session: MeResponse;
  area: WorkspaceArea;
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

  function navigation() {
    return GROUPS.map((group) => (
      <div key={group.label} className="mb-5">
        <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
          {group.label}
        </p>
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
                  'group relative flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300',
                  on
                    ? 'bg-gradient-to-r from-teal-400/20 to-teal-400/5 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )}
              >
                {on ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 -left-4 w-1 rounded-r-full bg-teal-300 shadow-[0_0_12px_rgb(94_234_212/70%)]"
                  />
                ) : null}
                <Icon
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    on ? 'text-teal-300' : 'text-slate-500 group-hover:text-slate-300',
                  )}
                  aria-hidden="true"
                />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    ));
  }

  const brand = (
    <Link href={home} className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-300 to-emerald-400 text-[#0b1a2e] shadow-[0_6px_20px_-6px_rgb(45_212_191/70%)]">
        <Building2 className="size-5" />
      </span>
      <span>
        <span className="block text-[17px] font-bold tracking-tight text-white">
          KBS<span className="font-normal text-slate-400"> Solutions</span>
        </span>
        <span className="text-[9.5px] tracking-[0.22em] text-slate-500 uppercase">
          {subtitle}
        </span>
      </span>
    </Link>
  );

  return (
    <div className="admin-workspace admin-canvas min-h-screen text-slate-900">
      <a
        href="#admin-content"
        className="sr-only fixed top-2 left-2 z-50 rounded-lg bg-white p-3 text-sm focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[linear-gradient(180deg,#0b1a2e_0%,#0e2236_60%,#0b1a2e_100%)] text-white lg:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(220px_120px_at_30%_0%,rgb(45_212_191/16%),transparent)]" />
        <div className="relative flex h-20 shrink-0 items-center px-6">{brand}</div>
        <nav
          aria-label={`${humanize(area)} navigation`}
          className="relative min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-5"
        >
          {navigation()}
        </nav>
        <Link
          href={`${accountBase}/account`}
          className="relative flex items-center gap-3 border-t border-white/10 px-5 py-4 hover:bg-white/5"
        >
          <Avatar name={name} className="bg-teal-300/15 text-teal-200 ring-1 ring-teal-300/30" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-slate-100">{name}</span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="size-3 text-teal-300" /> {roleLabel}
            </span>
          </span>
          <ChevronRight className="size-4 text-slate-500" />
        </Link>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => mobileNav.current?.showModal()}
            >
              <Menu />
            </Button>
            <span className="hidden text-[13px] text-slate-500 sm:inline">{active.group}</span>
            <ChevronRight className="hidden size-3.5 text-slate-300 sm:block" />
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-800">
              <active.icon className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
              <span className="truncate">{active.label}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-lg text-slate-500 xl:min-w-72 xl:justify-start"
              aria-label="Search workspace"
              onClick={() => search.current?.showModal()}
            >
              <Search />
              <span className="hidden font-normal xl:inline">Jump to a page…</span>
              <kbd className="ml-auto hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium xl:inline">
                ⌘K
              </kbd>
            </Button>
            <NotificationBell area={own} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh business data"
              title="Refresh data"
              disabled={refreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
            </Button>
            <details className="relative">
              <summary
                className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700 sm:pr-2"
                aria-label="Account menu"
              >
                <Avatar name={name} className="bg-gradient-to-br from-teal-600 to-teal-800 text-white" />
                <span className="hidden text-left sm:block">
                  <span className="block max-w-32 truncate text-xs font-semibold">{name}</span>
                  <span className="text-[11px] text-slate-500">{roleLabel}</span>
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_-20px_rgb(15_23_42/35%)]">
                <div className="flex items-center gap-3 bg-slate-50 px-4 py-3">
                  <Avatar name={name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="text-xs text-slate-500">{session.user.mobileMasked}</p>
                  </div>
                </div>
                <div className="grid p-1.5">
                  <Link
                    href={`${accountBase}/account`}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <UserRound className="size-4 text-slate-400" /> Account & support
                  </Link>
                  <Link
                    href={`${accountBase}/notifications`}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Bell className="size-4 text-slate-400" /> All notifications
                  </Link>
                </div>
                <div className="border-t border-slate-100 p-3">
                  <LogoutButton />
                </div>
              </div>
            </details>
          </div>
        </header>
        <SessionKeepAlive accessExpiresInSec={session.account?.accessExpiresInSec ?? 900} />
        <main
          id="admin-content"
          tabIndex={-1}
          className="admin-content mx-auto min-w-0 max-w-[1600px] p-4 outline-none sm:p-6"
        >
          {children}
        </main>
      </div>
      <dialog
        ref={mobileNav}
        aria-label={`${humanize(area)} navigation menu`}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] bg-[#0b1a2e] p-4 text-white backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
      >
        <div className="mb-6 flex items-center justify-between pl-2">
          {brand}
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-lg p-2 hover:bg-white/10"
            onClick={() => mobileNav.current?.close()}
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label={`Mobile ${area} navigation`} className="pl-4">
          {navigation()}
        </nav>
      </dialog>
      <dialog
        ref={search}
        aria-labelledby="workspace-search-title"
        onClose={() => {
          setQuery('');
          setCursor(0);
        }}
        className="fixed inset-x-0 top-[12vh] mx-auto w-[min(600px,calc(100%-32px))] max-w-none overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_30px_80px_-20px_rgb(15_23_42/45%)] backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm"
      >
        <h2 id="workspace-search-title" className="sr-only">
          Find your workspace
        </h2>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="size-5 text-slate-400" />
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
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
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
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 data-[active]:bg-teal-50 data-[active]:text-teal-900"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="text-[11px] text-slate-400">{group}</span>
              </span>
              <ArrowRight className="size-4 text-slate-300" />
            </Link>
          ))}
          {matches.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No workspace matches. Try “MIS” or “payout”.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span>
            <kbd className="rounded border bg-white px-1">↑</kbd>{' '}
            <kbd className="rounded border bg-white px-1">↓</kbd> to move
          </span>
          <span>
            <kbd className="rounded border bg-white px-1">Enter</kbd> to open
          </span>
          <span>
            <kbd className="rounded border bg-white px-1">Esc</kbd> to close
          </span>
        </div>
      </dialog>
    </div>
  );
}
