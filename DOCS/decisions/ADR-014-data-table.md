# ADR-014: Common DataTable on TanStack Table v9 (shadcn data-table guide)

- Status: Accepted · Date: 2026-09-28 · Feature: F-813

## Context
All 39 tables in `apps/web` were hand-written `<Table>`/`<TableHeader>`/`<TableBody>` markup (F-806/F-811). Every table re-implements the same mechanics: `data-label` per cell for the phone card mode, `sm:text-right tabular-nums` number alignment, sticky headers inside scrolling panels, `EmptyState` when empty, and five copies of the `A–B of T · page P of Q` pagination footer. The shadcn data-table guide (v9 edition: `tableFeatures`, `useTable`, `createColumnHelper`) gives the standard answer, and `@tanstack/react-table` 8.21.3 was already a dependency used by `leads-table.tsx`.

## Decision
- Upgrade to `@tanstack/react-table@9.2.4` (exact pin) and build one `DataTable` module at `apps/web/src/components/data-table/` following the guide: a `features` object (`rowSortingFeature`, `columnVisibilityFeature`, `rowExpandingFeature`, `rowSelectionFeature` + `sortedRowModel`/`expandedRowModel` + sort fns), a shared `columnHelper`, `DataTableColumnHeader`, `DataTableViewOptions`, `DataTablePagination`, `DataTablePanel`.
- Add shadcn `dropdown-menu` and `checkbox` primitives (`@radix-ui/react-dropdown-menu@2.1.24`, `@radix-ui/react-checkbox@1.3.11`, exact pins) for the sort/hide dropdown, the column toggle and opt-in row selection. This extends ADR-003's shadcn ownership model — these become owned code in `components/ui/` like `table.tsx`.
- Column metadata travels in `columnDef.meta` via the v9 `columnMeta` type slot: `label` (the `data-label`/view-menu text), `align`, `hideLabel`, `className`/`headerClassName`/`cellClassName`.
- **Pagination and filtering stay server-side** (`?page=` links + `next/form` filters). TanStack is used for layout, client-side sorting of the current page, column visibility, expansion and optional selection — not for data flow. Sort headers are labelled "this page".
- **RSC boundary:** cell renderers are functions, which cannot cross from Server to Client Components, so each table lives in a small `'use client'` file that exports `XxxTable({ rows })` and owns its column defs. Pages pass only serialisable props and server-rendered `empty`/`toolbar`/`footer` ReactNodes.
- The shadcn `Table` primitives remain the rendering layer; a lint rule restricts `useTable` and `ui/table` imports to the data-table module.

## Consequences
- ~500 lines of duplicated table chrome deleted; new tables are column defs + a client wrapper.
- Sorting, hiding and expanding behave identically on every table.
- Bundle: v9 tree-shakes by feature; the four registered features add a few kB, paid by every table page (acceptable — all are list/ops pages anyway).
- Hydration: date/`Intl` formatting now renders on the server **and** hydrates on the client; `formatDateTime` uses a fixed `Asia/Kolkata` zone so output is identical.

## Alternatives
- Keep hand-rolled tables: rejected — drift already visible (different empty states, labels, alignment).
- Server-side sorting (`?sort=`): rejected — API has no sort params; adds backend scope for a cosmetic nicety. Revisit only if users ask for global ordering.
- `@tanstack/react-table` v8: rejected — the upstream guide targets v9 and `leads-table.tsx` was the only consumer, so the upgrade cost is one file.
