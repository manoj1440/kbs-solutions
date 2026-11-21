import { LEGAL_PATHS } from '@kbs/shared';
import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalNav } from './_components/legal-nav';

/** F-908: public legal pages (no sign-in). Not for search engines: they serve people who already use KBS Solutions. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

const PAGES = [
  { href: LEGAL_PATHS.privacy, label: 'Privacy notice' },
  { href: LEGAL_PATHS.terms, label: 'Terms of use' },
  { href: LEGAL_PATHS.grievance, label: 'Grievances' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/login" className="flex items-center gap-2.5 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
            <span className="flex size-8 items-center justify-center rounded-lg brand-gradient text-sm font-semibold text-white" aria-hidden="true">
              K
            </span>
            <span className="text-base font-semibold">
              KBS<span className="font-normal text-muted-foreground"> Solutions</span>
            </span>
          </Link>
          <Link href="/login" className="rounded-md px-2 py-1.5 text-ui font-medium text-fg-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
            Sign in
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <LegalNav pages={PAGES} />
          <p className="text-xs text-muted-foreground">KBS Solutions</p>
        </div>
      </footer>
    </div>
  );
}
