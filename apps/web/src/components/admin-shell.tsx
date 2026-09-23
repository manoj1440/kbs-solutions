'use client';

import type { MeResponse } from '@kbs/shared';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Menu,
  Phone,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { NotificationBell } from '@/components/notification-bell';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { LogoutButton } from '@/components/logout-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const GROUPS: { label: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/admin', label: 'Business overview', icon: LayoutDashboard },
      { href: '/admin/leads', label: 'Leads & applications', icon: ListChecks },
      { href: '/admin/onboarding', label: 'Advisor approvals', icon: ClipboardCheck },
      { href: '/admin/users', label: 'People & teams', icon: Users },
    ],
  },
  {
    label: 'Sales operations',
    items: [
      { href: '/admin/calling-list', label: 'Calling lists', icon: Phone },
      { href: '/admin/calling-list/distribution', label: 'Calling allocation', icon: Users },
      { href: '/admin/catalogue', label: 'Card catalogue', icon: CreditCard },
      { href: '/admin/pincode-profiles', label: 'Bank coverage', icon: MapPin },
      { href: '/admin/training', label: 'Training content', icon: GraduationCap },
      { href: '/admin/training/team', label: 'Training progress', icon: ListChecks },
    ],
  },
  {
    label: 'Dashboards',
    items: [
      { href: '/admin/dashboards', label: 'Executive dashboard', icon: LayoutDashboard },
      { href: '/admin/dashboards/telecallers', label: 'Team performance', icon: Users },
      { href: '/admin/dashboards/bank-card-mix', label: 'Bank / card mix', icon: CreditCard },
      { href: '/admin/audit', label: 'Audit trail', icon: ShieldCheck },
    ],
  },
  {
    label: 'Bank data & finance',
    items: [
      { href: '/admin/mis', label: 'MIS imports', icon: FileSpreadsheet },
      { href: '/admin/mis/integrity', label: 'Data integrity', icon: ShieldCheck },
      { href: '/admin/payouts/liability', label: 'Payout liability', icon: LayoutDashboard },
      { href: '/admin/payouts/requests', label: 'Payout requests', icon: Wallet },
      { href: '/admin/payouts/requests?queue=exceptions', label: 'Payment exceptions', icon: AlertTriangle },
      { href: '/admin/payouts/entitlements', label: 'Entitlement ledger', icon: ListChecks },
      { href: '/admin/payouts/rules', label: 'Payout rules', icon: Settings2 },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admin/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/admin/config', label: 'Configuration', icon: Settings2 },
    ],
  },
];
const ITEMS = GROUPS.flatMap((g) => g.items);

export function AdminShell({
  session,
  children,
}: {
  session: MeResponse;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState('');
  const search = useRef<HTMLDialogElement>(null);
  const mobileNav = useRef<HTMLDialogElement>(null);
  const active =
    ITEMS.filter(
      (n) => pathname === n.href || (n.href !== '/admin' && pathname.startsWith(`${n.href}/`)),
    ).sort((a, b) => b.href.length - a.href.length)[0] ?? ITEMS[0];
  const name = session.user.fullName || session.user.mobileMasked;
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

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

  function navigation() {
    return GROUPS.map((group) => (
      <div key={group.label} className="mb-5">
        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
          {group.label}
        </p>
        <div className="grid gap-0.5">
          {group.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onClick={() => mobileNav.current?.close()}
              aria-current={active.href === href ? 'page' : undefined}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300',
                active.href === href
                  ? 'bg-teal-400/15 text-teal-200 ring-1 ring-inset ring-teal-300/20'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
              {active.href === href ? (
                <span className="ml-auto size-1.5 rounded-full bg-teal-300" />
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    ));
  }

  return (
    <div className="admin-workspace min-h-screen bg-[#f4f6f9] text-slate-900">
      <a
        href="#admin-content"
        className="sr-only fixed top-2 left-2 z-50 rounded-lg bg-white p-3 text-sm focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#111e30] text-white lg:flex">
        <Link
          href="/admin"
          className="flex h-24 shrink-0 items-center gap-3 border-b border-white/10 px-6"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-teal-300 text-[#111e30]">
            <Building2 className="size-6" />
          </span>
          <span>
            <span className="block text-xl font-bold tracking-tight">
              KBS<span className="font-normal text-slate-300"> Solutions</span>
            </span>
            <span className="text-[10px] tracking-[0.2em] text-slate-400 uppercase">
              Business workspace
            </span>
          </span>
        </Link>
        <nav aria-label="Admin navigation" className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {navigation()}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 px-6 py-5 text-xs text-slate-300">
          <ShieldCheck className="size-5 text-teal-300" />
          <span>
            Admin workspace
            <span className="mt-1 block text-[11px] text-slate-400">Role-controlled access</span>
          </span>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => mobileNav.current?.showModal()}
            >
              <Menu />
            </Button>
            <span className="hidden text-sm text-slate-500 sm:inline">Workspace</span>
            <ChevronRight className="hidden size-3.5 text-slate-400 sm:block" />
            <span className="truncate text-sm font-semibold">{active.label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              className="gap-2 text-slate-500 xl:min-w-64 xl:justify-start"
              aria-label="Search workspace"
              onClick={() => search.current?.showModal()}
            >
              <Search />
              <span className="hidden xl:inline">Find a workspace…</span>
              <kbd className="ml-auto hidden rounded border px-1.5 text-[10px] xl:inline">
                ⌘ / Ctrl K
              </kbd>
            </Button>
            <NotificationBell area="admin" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh business data"
              disabled={refreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
            </Button>
            <details className="relative">
              <summary
                className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-teal-700"
                aria-label="Account menu"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-32 truncate text-xs font-semibold">{name}</span>
                  <span className="text-[11px] text-slate-500">Administrator</span>
                </span>
              </summary>
              <div className="absolute right-0 mt-3 grid w-56 gap-3 rounded-xl border bg-white p-4 shadow-xl">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-slate-500">{session.user.mobileMasked}</span>
                <LogoutButton />
              </div>
            </details>
          </div>
        </header>
        <main
          id="admin-content"
          tabIndex={-1}
          className="admin-content mx-auto min-w-0 max-w-[1680px] p-4 outline-none sm:p-8"
        >
          {children}
        </main>
      </div>
      <dialog
        ref={mobileNav}
        aria-label="Admin navigation menu"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] bg-[#111e30] p-4 text-white backdrop:bg-slate-950/50"
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <span className="text-lg font-bold">KBS Solutions</span>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded p-2 hover:bg-white/10"
            onClick={() => mobileNav.current?.close()}
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Mobile admin navigation">{navigation()}</nav>
      </dialog>
      <dialog
        ref={search}
        aria-labelledby="workspace-search-title"
        className="fixed inset-0 m-auto w-[min(560px,calc(100%-32px))] max-w-none rounded-2xl border bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="workspace-search-title" className="font-semibold">
            Find your workspace
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close search"
            onClick={() => search.current?.close()}
          >
            <X />
          </Button>
        </div>
        <div className="p-4">
          <Input
            autoFocus
            aria-label="Search pages"
            placeholder="Try leads, payouts, training…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-3 pb-3">
          {ITEMS.filter((n) => n.label.toLowerCase().includes(query.trim().toLowerCase())).map(
            ({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => {
                  search.current?.close();
                  setQuery('');
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-teal-50 focus-visible:bg-teal-50"
              >
                <Icon className="size-4 text-teal-700" />
                {label}
                <ArrowRight className="ml-auto size-4 text-slate-400" />
              </Link>
            ),
          )}
          {!ITEMS.some((n) => n.label.toLowerCase().includes(query.trim().toLowerCase())) ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No workspace matches. Try “MIS” or “payout”.
            </p>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
