# F-813 — Common DataTable (shadcn data-table guide) for every web table

**Status:** DONE (2026-09-28) · **Depends on:** F-806 (design kit)F-811 (compact list pattern)

## Goal
One reusable `DataTable` module (`apps/web/src/components/data-table/`) built on **TanStack Table v9** following the shadcn data-table guide (`ui.shadcn.com/docs/components/radix/data-table`). Replaces all 39 hand-written `<Table>` usages in `apps/web` so table headers`data-label` card-mode labels, alignment, empty states, sub-rows and pagination footers come from one place. Server pages keep fetching/filtering/paginating as today.

## Decisions (2026-09-28user-approved)
| Topic | Decision |
|---|---|
| Scope | All 39 tables incl. detail-page and client editor tables |
| Sorting | Client-sidecurrent page only; UI labels it so. No API sort params |
| Deps | shadcn `checkbox` → `@radix-ui/react-checkbox@1.3.11` (dropdown-menu added then removed — user wants direct sort clickno popups/hide) |
| Pagination | Keep server `?page=` links (`DataTablePagination`); TanStack does no paging |
| TanStack | `@tanstack/react-table@9.2.4` (exact pin; guide targets v9 API) |

## Architecture
- `features.ts` — `tableFeatures({rowSortingFeaturecolumnVisibilityFeature, rowExpandingFeature, rowSelectionFeature, sortedRowModel, expandedRowModel, sortFns})`, `DataTableFeatures` type, `columnHelper()`, `ColumnMeta` augmentation (`label`, `hideLabel`, `align`, `className`, `headerClassName`, `cellClassName`).
- `data-table.tsx` — the only `useTable` call site; emits `data-label``meta.align`, `pl-4`/`pr-4` edges on `variant="panel"`, sub-rows, `data-state="selected"`, empty handling.
- `column-header.tsx` — click-to-sort header (asc → desc → none)no dropdown menus; column hiding not offered (user decision).
- `pagination.tsx` / `panel.tsx` / `cells.tsx` — **server-compatible** shared footer (`A–B of T · page P of Q`)F-811 section shell, and cells repeated 3+ times (`Dash`, `DateTimeCell`, `MonoCell`, `NumCell`, `PersonCell`, `BankCell`).
- **RSC boundary:** cell renderers are functions → each table gets a small `'use client'` file owning its columns; pages pass only serialisable row data + rendered `empty`/`toolbar`/`footer` ReactNodes.
- `components/ui/`: add `checkbox.tsx` (shadcn new-yorkindividual `@radix-ui/react-*` packages like `label`/`slot`).

## Guard-rails
Presentation-only. Stage/Decision/Activation stay three separate badge columns with provenance; bank values verbatim (INV-01/02/03); header text + `data-label` values stay byte-identical (e2e depends on them); no API/route/filter changes.

## Acceptance criteria
1. ✅ One `DataTable` module following the shadcn guide (click-to-sort headerpagination, selection support; no column-hide menu per user decision).
2. ✅ All 39 tables render through it; same headers`data-label`s, badges, links, copy.
3. ✅ Server pagination + URL filters unchanged; sorting client-side per page and labelled.
4. ✅ Phone card mode (normal + compact) unchanged.
5. ✅ ESLint `no-restricted-imports` forbids direct `@/components/ui/table` imports outside the module.
6. ✅ Unit tests green (24 incl. 12 data-table tests); Playwright 74/74 (session.spec refresh-race flake passed on retry — pre-existingsee F-808).
7. ✅ Docs updated: ADR-014UI README, this file, README index, PROGRESS.

## Migration inventory (39 tables / 26 files)
See plan. Batches: (a) admin list pages: usersmis, calling-list, audit ×2, pincode-profiles, compliance; (b) dashboards: admin-dashboard-tables ×4, team-ops ×2, admin/page, manager/page, manager/advisors, training-team-table, calling-distribution; (c) payouts ×6; (d) network ×3, retention ×2; (e) detail/editor: advisor detail ×3, lead-detail, MIS batch rows, wizard ×2, profile-editor ×2. `leads-table.tsx` ported to v9 first.

## Progress notes
