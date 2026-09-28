import {
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createSortedRowModel,
  type RowData,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';

/** Per-column options understood by `DataTable` (the v9 `columnMeta` type slot). */
export interface DataTableColumnMeta {
  /** Card-mode label (`data-label`) and the "View" menu text. Defaults to the string header. */
  label?: string;
  /** Omit the card-mode label for this cell. */
  hideLabel?: boolean;
  /** Right-align header + cells and use tabular numbers (`sm:text-right tabular-nums`). */
  align?: 'right';
  /** Class merged onto both `th` and `td`. */
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
  columnMeta: {} as DataTableColumnMeta,
});
export type DataTableFeatures = typeof features;

export const columnHelper = <TData extends RowData>() => createColumnHelper<DataTableFeatures, TData>();
