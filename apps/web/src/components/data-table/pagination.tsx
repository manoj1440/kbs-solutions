import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Server-compatible pagination footer for the F-811 panel pattern — the same
 * `A–B of T · page P of Q` copy + Prev/Next `Link`s every list page used to inline.
 */
export function DataTablePagination({
  page,
  pageSize,
  total,
  href,
  noun,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Server-side builder: `(page) => '/admin/users?...&page=N'` preserving current filters. */
  href: (page: number) => string;
  /** Noun for the empty state, e.g. 'users' → "0 users". */
  noun: string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className={cn('flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs', className)}>
      <span className="text-slate-500 tabular-nums">
        {total
          ? `${((page - 1) * pageSize + 1).toLocaleString('en-IN')}–${Math.min(page * pageSize, total).toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`
          : `0 ${noun}`}{' '}
        · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={href(page - 1)}>
              <ChevronLeft aria-hidden="true" />
              Previous
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={href(page + 1)}>
              Next
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
