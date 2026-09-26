import * as React from 'react';

import { cn } from '@/lib/utils';

function Table({
  className,
  responsive = false,
  ...props
}: React.ComponentProps<'table'> & {
  /** below 700px rows become labelled cards; 'compact' lays the labelled values out two per line */
  responsive?: boolean | 'compact';
}) {
  return (
    <div
      data-slot="table-container"
      data-responsive={responsive || undefined}
      data-compact={responsive === 'compact' || undefined}
      className="relative w-full min-w-0 overflow-x-auto"
    >
      <table
        role="table"
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      role="rowgroup"
      data-slot="table-header"
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  );
}
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      role="rowgroup"
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      role="row"
      data-slot="table-row"
      className={cn(
        'border-b border-slate-100 transition-colors hover:bg-slate-50/80 data-[state=selected]:bg-primary/5',
        className,
      )}
      {...props}
    />
  );
}
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      role="columnheader"
      data-slot="table-head"
      className={cn(
        'h-10 px-3 text-left align-middle text-[11px] font-semibold tracking-wide text-slate-500 uppercase whitespace-normal break-words',
        className,
      )}
      {...props}
    />
  );
}
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      role="cell"
      data-slot="table-cell"
      className={cn('px-3 py-2.5 align-middle whitespace-normal break-words', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
