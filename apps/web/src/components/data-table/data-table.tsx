'use client';

import {
  type ColumnDef,
  type ColumnVisibilityState,
  type ExpandedState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
  useTable,
} from '@tanstack/react-table';
import { Fragment, useEffect, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { DataTableColumnHeader } from './column-header';
import { type DataTableFeatures, features } from './features';
import { DataTableViewOptions } from './view-options';

type DataTableColumnDef<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  /** Stable row id (defaults to `row.id`, then row index). */
  getRowId?: (row: TData, index: number) => string;
  /**
   * 'panel' = the F-811 fill layout (borderless table inside a scrolling `DataTablePanel`,
   * sticky header, `pl-4`/`pr-4` edge padding). 'plain' keeps the `ui/table` container.
   */
  variant?: 'panel' | 'plain';
  /** Phone card mode; 'compact' lays values two per line. Default true. */
  responsive?: boolean | 'compact';
  className?: string;
  containerClassName?: string;
  headerClassName?: string;
  /** Rendered instead of the table when `data` is empty (usually `EmptyState`). */
  empty?: React.ReactNode;
  /** Keep the header and render this in a full-width row when `data` is empty. */
  emptyRow?: React.ReactNode;
  /** Client-side sort applied to the rows passed in (initial state). */
  initialSorting?: SortingState;
  /** Controlled column visibility (e.g. the leads "All columns" toggle). */
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (v: ColumnVisibilityState) => void;
  initialColumnVisibility?: ColumnVisibilityState;
  /** Show the "View" column-toggle menu. */
  viewOptions?: boolean;
  /** Extra controls rendered next to the View menu above the table. */
  toolbar?: React.ReactNode | ((table: ReturnType<typeof useTable<DataTableFeatures, TData>>) => React.ReactNode);
  /** Expandable rows: render this panel under expanded rows. */
  renderSubRow?: (row: Row<DataTableFeatures, TData>) => React.ReactNode;
  /** DOM id for the sub-row (e.g. `lead-details-${id}`). */
  getSubRowId?: (row: TData) => string;
  /** Extra props on each body row (e.g. `data-collision`). */
  getRowProps?: (row: TData) => Omit<React.ComponentProps<'tr'>, 'key' | 'ref'> & Record<`data-${string}`, string | boolean | undefined>;
  /** Adds a checkbox selection column; `onRowSelectionChange` reports the selected originals. */
  enableRowSelection?: boolean;
  onRowSelectionChange?: (rows: TData[]) => void;
  /** The data is one page of a server-paged list — sort headers say "Sorts this page only". */
  pagedOnServer?: boolean;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  variant = 'plain',
  responsive = true,
  className,
  containerClassName,
  headerClassName,
  empty,
  emptyRow,
  initialSorting,
  columnVisibility,
  onColumnVisibilityChange,
  initialColumnVisibility,
  viewOptions = false,
  toolbar,
  renderSubRow,
  getSubRowId,
  getRowProps,
  enableRowSelection = false,
  onRowSelectionChange,
  pagedOnServer = false,
}: DataTableProps<TData>) {
  'use no memo'; // TanStack Table returns unstable functions; React Compiler must skip this component.
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [internalVisibility, setInternalVisibility] = useState<ColumnVisibilityState>(initialColumnVisibility ?? {});
  const visibility = columnVisibility ?? internalVisibility;

  const selectColumn: DataTableColumnDef<TData> = {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    meta: { hideLabel: true },
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? 'indeterminate' : false}
        onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
        aria-label="Select all rows"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
      />
    ),
  };

  const table = useTable<DataTableFeatures, TData>({
    features,
    data,
    columns: enableRowSelection ? [selectColumn, ...columns] : columns,
    getRowId: getRowId ?? ((row: TData, index: number) => (row as { id?: string }).id ?? String(index)),
    state: { sorting, columnVisibility: visibility, expanded, rowSelection },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: (updater: Updater<ColumnVisibilityState>) => {
      const next = typeof updater === 'function' ? updater(visibility) : updater;
      if (onColumnVisibilityChange) onColumnVisibilityChange(next);
      else setInternalVisibility(next);
    },
    onRowSelectionChange: setRowSelection,
    getRowCanExpand: renderSubRow ? () => true : undefined,
  });

  const selectedRowsEffect = onRowSelectionChange;
  useEffect(() => {
    if (selectedRowsEffect) selectedRowsEffect(table.getSelectedRowModel().rows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emit originals, not ids; keyed on the selection slice only
  }, [rowSelection]);

  const leafCount = table.getVisibleLeafColumns().length;
  const toolbarNode = typeof toolbar === 'function' ? toolbar(table) : toolbar;

  if (empty && data.length === 0) return <>{empty}</>;

  const body = (
    <Table
      responsive={responsive}
      className={className}
      containerClassName={cn(variant === 'panel' && 'rounded-none! border-0! lg:h-full lg:overflow-y-auto', containerClassName)}
    >
      <TableHeader className={cn(variant === 'panel' && 'sticky top-0 z-10', headerClassName)}>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h, i) => {
              const def = h.column.columnDef;
              const meta = def.meta;
              return (
                <TableHead
                  key={h.id}
                  aria-sort={h.column.getIsSorted() === 'asc' ? 'ascending' : h.column.getIsSorted() === 'desc' ? 'descending' : undefined}
                  className={cn(
                    variant === 'panel' && (i === 0 ? 'pl-4' : i === hg.headers.length - 1 ? 'pr-4' : undefined),
                    meta?.align === 'right' && 'sm:text-right tabular-nums',
                    meta?.className,
                    meta?.headerClassName,
                  )}
                >
                  {h.isPlaceholder ? null : typeof def.header === 'string' && h.column.getCanSort() ? (
                    <DataTableColumnHeader column={h.column} title={def.header} paged={pagedOnServer} className={meta?.align === 'right' ? 'sm:justify-end' : undefined} />
                  ) : (
                    <table.FlexRender header={h} />
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={leafCount} className="p-4">
              {emptyRow ?? empty ?? 'No results.'}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <TableRow data-state={row.getIsSelected() ? 'selected' : undefined} {...getRowProps?.(row.original)}>
                {row.getVisibleCells().map((cell, i, cells) => {
                  const meta = cell.column.columnDef.meta;
                  const label = meta?.hideLabel ? undefined : (meta?.label ?? (typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : undefined));
                  return (
                    <TableCell
                      key={cell.id}
                      data-label={label}
                      className={cn(
                        variant === 'panel' && (i === 0 ? 'pl-4' : i === cells.length - 1 ? 'pr-4' : undefined),
                        meta?.align === 'right' && 'sm:text-right tabular-nums',
                        meta?.className,
                        meta?.cellClassName,
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })}
              </TableRow>
              {renderSubRow && row.getIsExpanded() ? (
                <TableRow id={getSubRowId?.(row.original)} className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableCell colSpan={leafCount}>{renderSubRow(row)}</TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (!viewOptions && !toolbarNode) return body;
  return (
    <div className="grid min-w-0 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-slate-100 px-3 py-2">
        {toolbarNode}
        {viewOptions ? <DataTableViewOptions table={table} /> : null}
      </div>
      {body}
    </div>
  );
}
