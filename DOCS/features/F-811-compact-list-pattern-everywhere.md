# F-811 — Compact list/table pattern across Admin + Manager

**Status:** DONE (2026-09-28) · **Depends on:** F-806 (design kit), F-808/F-809/F-810 (pattern established)

## Goal

The F-808 → F-810 single-screen pattern (business tiles → compact filter/action row → internally-scrolling table → footer pagination, no `PageHeader`/`StatGrid`/`SectionCard` chrome on operational pages) applied to **every** Admin/Manager/Accounts list and dashboard page. No new components; `MiniStat` + plain `<section>` panels everywhere.

## Pages changed

| Area | Change |
|---|---|
| `admin/users` `admin/onboarding` `admin/training` `admin/training/team` `admin/catalogue` `admin/pincode-profiles` `admin/audit` | PageHeader/StatGrid/SectionCard → MiniStat tiles + panel with filter row + table internal scroll + footer |
| `payouts/requests` (`PayoutRequestsList`, shared admin/manager/accounts) | same; queue/state pills moved into the panel header; accounts mode keeps 3 queue tiles as info |
| `payouts/entitlements` (`EntitlementsLedger`, shared) | 6 StatCards → 6 MiniStats; state pills + table inside panel |
| `payouts/rules` | tiles + bank coverage chips + rule cards + NewRule in one internal scroll |
| `payouts/liability` (`PayoutDashboard`, shared admin/manager/accounts) | 8 ledger tiles as MiniStats + compact filter form + buckets/backlog row + exceptions table in panel |
| `admin/retention` | tiles + blocked callout + dry-run table & legal-holds panel side-by-side (minmax(0,·) grid fix) |
| `admin/network` | tiles + fail-closed callout + networks/WFH/events panels in one screen |
| `admin/compliance` | tiles + actions + suppression table in panel |
| `admin/config` | tiles + launch-gate callout + section nav + grouped key sections scroll inside the viewport |
| `admin/dashboards/{telecallers,managers,advisors,bank-card-mix}` (`Frame`) | PageHeader/StatGrid/Field-form → MiniStat tiles + dashboard pills + inline date form + internal-scroll table |
| `manager` home, `manager/advisors`, `manager/pending-actions`, `manager/calling` (`OperationsDashboard` header) | same pattern |
| notifications (`NotificationCentre`, all roles) | top control bar + scrollable list panel + footer pagination |

`/admin` business overview — compacted too: pinned slim control row (period pills + Filters overlay + Explore leads + Import bank MIS + range/scope/as-of meta), 4 `MiniStat` KPIs carrying `delta · source` in the hint (arrows text-encoded per REQ-20), funnel + attention + bank + payout as slim `Panel` sections inside the internal scroll, `OpsSections` + provenance footer below.
Not touched: detail/editor pages (lead, batch, user, card, profile, module, rule — `PageHeader` is their identity header; pages scroll as documents by design).

## Mechanics

- Wrapper: `flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]` — tiles `shrink-0`, one `min-h-0 flex-1` panel; table via `containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto"` + sticky `<TableHeader>`.
- Footers: `1–N of T · page P of Q` + Prev/Next preserving existing params.
- Two-column pages must use `lg:grid-cols-[minmax(0,…)_minmax(0,…)]` — bare `1fr` columns can overflow the viewport.

## Verification

- `tsc --noEmit` and eslint clean (only the known TanStack `useReactTable` compiler warning).
- Playwright desktop: admin-smoke 31/31 + session 3/3 + manager-advisors + role-routing = 34 pass. Phone project: 36 pass / 1 skip (desktop-only sidebar). 1440×900: every touched page = zero page scroll, zero horizontal overflow; 390px: clean card mode.
- **E2E env discovered:** specs that log in need `E2E_PG_CONTAINER=kbs-test-pg E2E_PG_DB=kbs_dev` (plus `E2E_BASE_URL`/`E2E_API_URL=…/api/v1`) or `clearOtp` is a no-op and every second login hits `AUTH_OTP_RESEND_TOO_SOON`. All earlier "session-refresh race" flakes traced to this — not a product bug.
- Real MIS upload through the modal verified end-to-end (F-809 flow still intact).

Not pushed.
