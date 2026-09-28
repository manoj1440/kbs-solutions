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
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]', className)}
    >
      {toolbar ? <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 p-3">{toolbar}</div> : null}
      <div className="min-h-0 flex-1">{children}</div>
      {footer}
    </section>
  );
}
