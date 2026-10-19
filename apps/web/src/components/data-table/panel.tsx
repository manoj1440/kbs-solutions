import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The F-811 one-screen list shell: labelled panel + toolbar row + flexible body
 * (usually a `DataTable` with `variant="panel"`) + optional footer (`DataTablePagination`).
 */
export function DataTablePanel({
  label,
  toolbar,
  footer,
  children,
  className,
  id,
}: {
  label: string;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-transparent bg-card shadow-card', className)}
    >
      {toolbar ? <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle p-3">{toolbar}</div> : null}
      <div className="min-h-0 flex-1">{children}</div>
      {footer}
    </section>
  );
}
