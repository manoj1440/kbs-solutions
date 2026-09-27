# F-807 Admin navigation by responsibility + business-first home

- Group: UX shells · Status: **DONE** · Depends on: F-806, F-703
- PRD refs: REQ-16 §16.2 (Admin dashboards), REQ-20 §20.2/§20.4 (text not colour-only, alerts never hidden), REQ-25 §25.4 (Admin screen inventory)
- Origin: user request (2026-09-27) — "classification is very cluttered … each functionality bound to a single responsibility … dashboard should show the business at first glance."

## Audit (before)
1. Two homes: `/admin` Business overview (all-time snapshot) and `/admin/dashboards` Executive dashboard (filtered) overlap.
2. Sidebar groups mixed jobs: "Sales operations" = calling + catalogue + coverage + training; "Dashboards" held Audit; "Bank data & finance" held MIS and payouts; "Workspace" held approvals/people next to leads.
3. Duplicates: Payout liability in sidebar and dashboard tabs; "Payment exceptions" is a filter of Payout requests; Notifications/Account also in header menus.
4. Dashboard tab row mixed reports with MIS integrity, payout liability, audit.
5. Home gave compliance/launch readiness the same weight as business numbers; no period.

## Decisions (user, 2026-09-27)
- Sidebar: Home · Sales · Calling · People · Products · Bank MIS · Payouts · Reports · Settings. Notifications/Account only in header bell/avatar menu.
- Merge Executive into `/admin`; `/admin/dashboards` redirects (query kept).
- Default period: this month (MTD), compared with the same days of last month; KPI deltas shown.

## Acceptance criteria
- [x] Each sidebar group owns one responsibility; no page listed twice; every Admin route still reachable (sidebar, tab or drill-down).
- [x] Dashboard tab row = reports only (Telecallers, Managers, Advisors, Bank / card mix).
- [x] `/admin` shows period chips, hero KPIs with change vs previous period, conversion funnel, bank-wise table, attention queues; ops detail and launch readiness below.
- [x] Bank values used verbatim (decision `APPROVE`, activation via `statusTone`), stage/decision/activation separate, unknown neutral (INV-01..03); every figure keeps source + date basis.
- [x] `/admin/dashboards` redirects to `/admin` keeping filters.
- [x] typecheck, lint, unit, web Playwright green; Admin route sweep at 1280/390.

## Progress notes
- 2026-09-27 (session 14): built and verified.
  - Sidebar (`workspace-shell.tsx`): Overview · Sales · Calling · People · Products · Bank MIS · Payouts · Reports · Settings. Admin "You" pages stay in the breadcrumb/⌘K index but not the sidebar. Page eyebrows renamed to the new groups.
  - Report tabs (`admin-dashboard-nav.tsx`): Telecallers, Managers, Advisors, Bank / card mix. Audit no longer shows them.
  - `/admin` (`app/(admin)/admin/page.tsx`): period chips (`resolvePeriod` in `lib/admin-overview.ts`, IST days; MTD compared with the same days of last month, clamped), custom dates & filters (`OpsFilters`), 4 KPIs with change (`Delta`: arrow + % text + previous value), funnel Leads → MIS matched → Approved → Activated (same cohort; calling shown separately, not as a step), bank performance (bank-card-mix aggregated per bank + per-bank MIS freshness), attention (4 queues + every executive alert), all-time payout position, collapsed operational detail (`OpsSections`). Failed loads show "Unavailable", never 0.
  - "Approved"/"Activated" = `statusTone(...) === 'success'` on the verbatim MIS buckets (`countSuccess`), so web and mobile agree.
  - `/admin/dashboards` redirects to `/admin` (query kept); report drill-downs link to `/admin?period=all&telecallerId|managerId=…`.
  - No API, schema or mobile change. Removed `summarizeBanks` (the home no longer reads `/dashboards/mis-integrity`).
- Checks: workspace typecheck + lint (existing TanStack warning only); web unit 15/15; web production build; Playwright 75 passed / 1 skipped (desktop-only sidebar test on phone) on the production build against the local API; 57-route sweep at 1440 with zero overflow; home at 390 with zero overflow after a `min-w-0` fix.
- Follow-ups: per-bank "approved" on the home needs `approved` in `/dashboards/admin/bank-card-mix` (API). Commit `a10c2c0` does not typecheck on its own (the page switched over in `fb3e189`).
