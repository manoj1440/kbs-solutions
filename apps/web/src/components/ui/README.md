# Web design system (F-806, refreshed by F-814)

F-817 reference look on a creamy palette: cream canvas, warm-white 22px cards with no visible border, near-black primary, orange hero accent (`brand`: hero tile, charts, progress, logo, unread dot), teal secondary / positive accent, warm greys (`stone-*`), pill buttons/inputs/selects, soft tinted badges, tabular numbers. Glass (F-817 r3): `.glass` for floating panels and KPI tiles, `.glass-strong` for menus/dialogs, `.glass-tile` for tiles inside glass — never on data tables or forms. Shell: one collapsible left sidebar with every page (icons only ↔ labels, `kbs_nav` cookie) + floating top bar (section › page, icons, user). Reference implementation: `src/app/(admin)/admin/mis/page.tsx`. F-814 plan and page tracker: `DOCS/features/F-814-web-ui-v2.md`.

## Rules
1. **Presentation only.** Never change API calls, payloads, routes, permissions, validation, form field names/ids, button labels used by tests, or compliance copy. Keep every piece of information a page shows today.
2. **Bank values are verbatim.** Stage / Decision / Activation stay three separate labelled badges (`StageBadge`, `DecisionBadge`, `ActivationBadge`) with `ProvenanceChip`. Never humanise, recolour or merge them.
3. **Humanise KBS enums only** with `humanize()` (`PENDING_ONBOARDING` → "Pending onboarding"). Config keys, public refs (`KBS-…`), file names and bank values are shown as-is.
4. **One `h1` per page**, rendered by `PageHeader`.
5. Links inside tables are styled automatically (foreground, semibold, no underline) — do not add `underline`.
6. Use `EmptyState` instead of "No … yet." table rows; `Callout` instead of ad-hoc coloured boxes.
7. No new dependencies; icons from `lucide-react`; charts are the kit's SVG components (`TrendChart`, `Sparkline`, `MiniBars`, `Meter`). Exceptions: the shadcn `checkbox` primitive and TanStack Table v9 behind the common `DataTable` (ADR-014).
8. Numbers: `tabular-nums`, right-aligned in tables.
9. **Tokens only (F-814).** No `slate-*`, `bg-white`, hex or `shadow-[…]` in files you touch; text sizes are `text-2xs` (11) / `text-xs` (12) / `text-ui` (13) / `text-sm`+ — `text-[Npx]` only for display headings (15 px+) or glyphs inside marks. Run `node test/tokenize.mjs <files>` first, then fix what it lists as "left". New custom tokens must be added to `extendTailwindMerge` in `lib/utils.ts`.
10. **No eyebrows** (uppercase kicker above a heading). `PageHeader` ignores `eyebrow` (and, since F-817, `icon`); the section pill + rail label name the page.

## Tokens (F-814, `app/globals.css` `:root`)
| Utility | Use |
|---|---|
| `bg-canvas` / `bg-card` / `bg-surface-muted` / `bg-muted` / `bg-surface-strong` / `bg-surface-selected` | page ground → cards → table headers/hover → chips → tracks → selected rows |
| `text-foreground` / `text-fg-2` / `text-muted-foreground` / `text-fg-3` | primary → secondary → hints → decorative only (fails 4.5:1 on white — never body text) |
| `border-border` / `border-border-subtle` / `border-border-strong` | default → inner dividers → hover/emphasis |
| `bg-brand` / `text-brand-strong` / `bg-brand-soft`, `.brand-gradient`, `.brand-hatch` | the one accent — hero KPI, chart highlight, progress, logo |
| `shadow-card` / `shadow-pop` | resting cards → lifted/hover, popovers, tooltips |
| `text-primary`, `ring-ring` | near-black primary, focus |

Fonts: Inter (`font-sans`) and JetBrains Mono (`font-mono`) via `next/font` in `app/layout.tsx`. The `@kbs/ui-tokens` package is shared with mobile — web overrides live in `globals.css`, never change the package for web.

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
| `DetailHeader` (F-814) | Detail pages: `back`, `visual`, `title` (the h1), `subtitle`, `meta`, `actions`, children = summary strip. No eyebrow. |
| `RailCard` (F-814) | Right-rail / agenda list: `title`, `count`, linked `items`, `empty`, `footer`. |
| `StatStrip` (F-814) | Wrap the `MiniStat` tiles of list pages: `cols` 3/4/5/6/8; grid from `sm`, swipeable row on phones. |
| `StatCard` `delta` / `chart` (F-814) | Pass `<DeltaBadge current previous />` and `<Sparkline values label />`. |

## Data visuals (F-814)
| Component | File | Use |
|---|---|---|
| `TrendChart` | `ui/trend-chart.tsx` (client) | Area/line over time: `labels`, `series[{key,label,tone,values}]`, `format` (`number`/`inr`), `title`. Legend toggles, hover + ←/→ reading, peak marker, sr-only table. |
| `DeltaBadge` | `ui/charts.tsx` | Change vs previous period as text (▲ 12% / ▼ / no change / new). `goodWhen="down"` for counts where lower is better. |
| `Sparkline` | `ui/charts.tsx` | Recent history of one number, only with real data and a `label`. |
| `MiniBars` | `ui/charts.tsx` | Ranked bars with value + hint as text (funnels, mixes). |

Live examples with fixture data: `/dev/components`.

Checks (dev, need web :3000 + api :4000): `node test/admin-shots.mjs <dir> 1440|390` (signed-in sweep, prints overflow), `node test/public-shots.mjs <dir>` (signed-out screens), `node test/contrast-check.mjs` (WCAG AA text contrast), `npx impeccable detect src` (anti-patterns).

Shell: no MIS clock since F-816 (bank status is a business rule, not a headline); `GET /mis/freshness` stays for the mobile Manager home. Web says bank status in plain words via `lib/bank-text.ts` (`bankText`, `AWAITING_BANK`).

## Definition of done for a page (F-814)
Tokens only · kit components only (no page-local `Stat`/`Panel`) · empty/loading/error/disabled states · 1440 and 390 screenshots with overflow 0 and no clipping · `npx impeccable detect <files>` clean (impeccable.style, free) · e2e selectors unchanged (or spec updated in the same commit).

Tones (F-817): decorative tones share a neutral icon chip and differ only in bar/dot colour — `teal` = orange brand, `indigo` = black, `sky`/`violet`/`slate` = greys; `amber` (attention), `rose` (errors/exceptions), `emerald` (success/paid) keep their meaning. Raw `teal-*`/`indigo-*`/`violet-*` classes are gone from `src` — use neutral or the tokens.

## Tables (`@/components/data-table`, F-813 / ADR-014)

Never hand-write `<Table>` — every table renders through `DataTable` (ESLint enforces this; `ui/table.tsx` is the low-level primitive it wraps).

```tsx
'use client';
const c = columnHelper<Row>();
export function MyTable({ rows }: { rows: Row[] }) {
  const columns = c.columns([
    c.accessor('name', { header: 'Name' }),                                          // sortable text
    c.accessor('amountInr', { header: 'Amount' }),                                   // all values left-aligned
    c.accessor('at', { header: 'When', sortFn: 'datetime', cell: DateTimeCell }),    // date sort
    c.display({ id: 'actions', header: '', meta: { hideLabel: true }, cell: … }),    // no data-label
  ]);
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<EmptyState … />} />;
}
```

- `variant="panel"` (default when inside `DataTablePanel`) adds edge padding + sticky header for scrollable sections; use `DataTablePanel` + `DataTablePagination` (server `?page=` links) for the F-811 list layout.
- Column meta: `label` (card-mode display name), `hideLabel`, `className`/`headerClassName`/`cellClassName`. Cells are always left-aligned (numbers keep `tabular-nums` via the cell).
- Sorting: click a header — cycles asc → desc → none, no menus (user decision: no popups, no column hiding).
- Features: `initialSorting`, `enableRowSelection`, `renderSubRow`/`getSubRowId`, `getRowProps`, `pagedOnServer` (labels sorting as page-local).
- `responsive` (default) = phone card mode via `data-label`; `responsive="compact"` for dense ops tables; `responsive={false}` for raw grids (e.g. dynamic columns).
- Shared cells: `Dash`, `DateCell`, `DateTimeCell`, `MonoCell`, `PersonCell`, `BankCell`.
- **RSC boundary:** column defs are functions → table components live in `'use client'` files; server pages pass rows + rendered `empty`/`toolbar`/`footer` nodes only.

Primitives in this folder (`Button` incl. `soft` variant, `Badge` soft tones, `Card`, `Input`, `Table`) keep shadcn APIs.
