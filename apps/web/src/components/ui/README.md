# Web design system (F-806)

Premium operations console: calm grey canvas, white elevated surfaces, teal primary, navy sidebar, soft tinted badges, tabular numbers. Reference implementation: `src/app/(admin)/admin/mis/page.tsx`.

## Rules
1. **Presentation only.** Never change API calls, payloads, routes, permissions, validation, form field names/ids, button labels used by tests, or compliance copy. Keep every piece of information a page shows today.
2. **Bank values are verbatim.** Stage / Decision / Activation stay three separate labelled badges (`StageBadge`, `DecisionBadge`, `ActivationBadge`) with `ProvenanceChip`. Never humanise, recolour or merge them.
3. **Humanise KBS enums only** with `humanize()` (`PENDING_ONBOARDING` → "Pending onboarding"). Config keys, public refs (`KBS-…`), file names and bank values are shown as-is.
4. **One `h1` per page**, rendered by `PageHeader`.
5. Links inside tables are styled automatically (teal, no underline) — do not add `underline`.
6. Use `EmptyState` instead of "No … yet." table rows; `Callout` instead of ad-hoc coloured boxes.
7. No new dependencies; icons from `lucide-react`; charts are CSS (`Meter`) or inline SVG. Exceptions: the shadcn `dropdown-menu`/`checkbox` primitives and TanStack Table v9 behind the common `DataTable` (ADR-014).
8. Numbers: `tabular-nums`, right-aligned in tables.

## Components (`@/components/ui/kit`)
| Component | Use |
|---|---|
| `PageHeader` | `icon`, `eyebrow` (nav group), `title`, `description`, `actions`, `meta`, optional children (usually a `StatGrid`). |
| `StatGrid` / `StatCard` | KPI tiles: `label`, `value`, `hint`, `source`, `icon`, `tone`, `href`, `emphasis` (one gradient hero tile per page at most). |
| `SectionCard` | Titled card: `icon`, `tone`, `title` (h2), `description`, `actions`, `flush` (table touches edges). |
| `EmptyState` | Icon + title + guidance + optional action. |
| `PillNav` | Link tabs / queues with optional `count`. Caller passes `active` href. |
| `Avatar` / `initials` | People (deterministic colour). |
| `BankMark` / `bankGradient` | Bank monogram (brand-neutral colours). `CreditCardArt` in `@/components/card-art`. |
| `Meter` | Horizontal bar for proportions. |
| `KeyValueGrid` | Label/value pairs on detail pages. |
| `Callout` | `info` / `warning` / `danger` / `success` / `neutral` notices. |
| `StatusDot` | KBS state as dot + text (user status, health). |
| `Field` + `selectClass` | Form/filter label + control; native `<select>` gets the chevron globally. |
| `IconTile`, `TONE`, `humanize` | Building blocks. |

Tones: `teal` (primary/money), `indigo` (bank data), `sky` (info/activity), `violet` (people), `amber` (attention), `rose` (errors/exceptions), `emerald` (success/paid), `slate` (neutral).

## Tables (`@/components/data-table`, F-813 / ADR-014)

Never hand-write `<Table>` — every table renders through `DataTable` (ESLint enforces this; `ui/table.tsx` is the low-level primitive it wraps).

```tsx
'use client';
const c = columnHelper<Row>();
export function MyTable({ rows }: { rows: Row[] }) {
  const columns = c.columns([
    c.accessor('name', { header: 'Name' }),                                          // sortable text
    c.accessor('amountInr', { header: 'Amount', meta: { align: 'right' } }),          // numeric + right
    c.accessor('at', { header: 'When', sortFn: 'datetime', cell: DateTimeCell }),    // date sort
    c.display({ id: 'actions', header: '', meta: { hideLabel: true }, cell: … }),    // no data-label
  ]);
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState … />} />;
}
```

- `variant="panel"` (default when inside `DataTablePanel`) adds edge padding + sticky header for scrollable sections; use `DataTablePanel` + `DataTablePagination` (server `?page=` links) for the F-811 list layout.
- Column meta: `label` (display name for the View toggle), `hideLabel`, `align:'right'`, `className`/`headerClassName`/`cellClassName`.
- Features: `initialSorting`, `viewOptions` (column toggle), `enableRowSelection`, `renderSubRow`/`getSubRowId`, `getRowProps`, `pagedOnServer` (labels sorting as page-local).
- `responsive` (default) = phone card mode via `data-label`; `responsive="compact"` for dense ops tables; `responsive={false}` for raw grids (e.g. dynamic columns).
- Shared cells: `Dash`, `DateCell`, `DateTimeCell`, `MonoCell`, `PersonCell`, `BankCell`.
- **RSC boundary:** column defs are functions → table components live in `'use client'` files; server pages pass rows + rendered `empty`/`toolbar`/`footer` nodes only.

Primitives in this folder (`Button` incl. `soft` variant, `Badge` soft tones, `Card`, `Input`, `Table`) keep shadcn APIs.
