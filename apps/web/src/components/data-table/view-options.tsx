'use client';

import { type ReactTable, type RowData } from '@tanstack/react-table';
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { DataTableFeatures } from './features';

/** "View" column-toggle dropdown from the shadcn data-table guide; labels come from `meta.label`. */
export function DataTableViewOptions<TData extends RowData>({
  table,
  className,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  className?: string;
}) {
  const hideable = table.getAllColumns().filter((column) => column.getCanHide());
  if (!hideable.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8', className)} aria-label="Toggle columns">
          <Settings2 aria-hidden="true" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
          >
            {column.columnDef.meta?.label ??
              (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
