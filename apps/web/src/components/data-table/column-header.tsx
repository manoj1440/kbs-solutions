'use client';

import { type Column, type RowData } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { DataTableFeatures } from './features';

interface DataTableColumnHeaderProps<TData extends RowData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
  /** The table shows a server-paged slice; the hint tells the user sorting only reorders it. */
  paged?: boolean;
}

/** Sortable column header — click cycles asc → desc → none. */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  paged,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) return <div className={cn(className)}>{title}</div>;
  const sorted = column.getIsSorted();
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2 text-[11px] font-semibold tracking-wide uppercase"
        onClick={column.getToggleSortingHandler()}
        title={paged ? 'Sorts this page only' : undefined}
        aria-label={`Sort by ${title}`}
      >
        <span>{title}</span>
        {sorted === 'desc' ? (
          <ArrowDown className="size-3 text-teal-700" aria-hidden="true" />
        ) : sorted === 'asc' ? (
          <ArrowUp className="size-3 text-teal-700" aria-hidden="true" />
        ) : (
          <ChevronsUpDown className="size-3 text-slate-400" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
