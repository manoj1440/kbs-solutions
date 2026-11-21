'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/** Footer links between the legal pages; the current page is marked for screen readers and by weight. */
export function LegalNav({ pages }: { pages: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Legal pages">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-ui">
        {pages.map((p) => {
          const current = path === p.href;
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:min-h-0',
                  current ? 'font-semibold text-foreground' : 'text-fg-2 underline-offset-4 hover:text-foreground hover:underline',
                )}
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
