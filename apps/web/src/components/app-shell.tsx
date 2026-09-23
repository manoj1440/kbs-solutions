import type { MeResponse } from '@kbs/shared';
import Link from 'next/link';

import { LogoutButton } from '@/components/logout-button';
import { Badge } from '@/components/ui/badge';

export interface NavItem {
  href: string;
  label: string;
}

/** F-801: sidebar + top bar shell shared by the role areas. (shadcn Sidebar primitives arrive with the full component set.) */
export function AppShell({ session, nav, title, children }: { session: MeResponse; nav: NavItem[]; title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="bg-card flex flex-col gap-3 border-b p-4 md:gap-4 md:border-r md:border-b-0">
        <div>
          <div className="text-lg font-semibold">KBS Solutions</div>
          <div className="text-muted-foreground text-xs">{title}</div>
        </div>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="hover:bg-accent rounded-md px-3 py-2 text-sm">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2 text-sm md:mt-auto md:grid">
          <div className="truncate font-medium">{session.user.fullName || session.user.mobileMasked}</div>
          <Badge variant="secondary">{session.user.role}</Badge>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-6">{children}</main>
    </div>
  );
}
