# F-812 — Admin home: business numbers only (web + API)

**Status:** DONE (2026-09-28) · **Depends on:** F-807/F-811 (home), F-808 (record status), F-809 (MIS applications summary), F-810 (leads summary), F-606 (payout summary)

## Origin
User (2026-09-28): "/admin should show the business at first glance, not config — total telecallers, managers, advisors, accounts; calling data (connected / not connected / declined…); MIS (applications, approved, in process, cards activated, total payout); how many banks/cards configured — numbers only; and a table of recent leads with exact status."

## Audit (before)
`/admin` = period chips + filter overlay + KPIs with deltas + funnel + attention queues + bank performance + payout position + collapsible ops detail + launch-gate alerts. Eight API calls per render; two of them the heavy `/dashboards/admin/executive`. Team size, calling record statuses and MIS application counts (all built in F-808/F-809/F-810) were not on the home at all.

## Built
- **API** `GET /dashboards/admin/home` (`DASHBOARD_ADMIN`, Admin only): one `Promise.all` that *passes through* the owning services — `user.groupBy(role,status)`, `CallingQueueService.summary`, `MisImportService.applicationsSummary`, `LeadsService.summary` + `list(pageSize 10)`, `PayoutDashboardService.summary` totals, bank/card counts. Nothing in the endpoint computes a bank value (INV-01..03). `DashboardsModule` now imports `CallingListModule`, `MisModule`, `LeadsModule`.
- **Web** `/admin`: one fetch; sections Team (4) · Calling (8, F-808 exclusive statuses; "Interested / link shared" is the furthest KBS-known step — there is deliberately no "converted") · Bank MIS & payouts (8) · Recent leads table (10 newest, Stage / Decision / Activation badges, MIS-matched time). No period, filters, deltas or launch-gate content. Failed load → warning callout, never zeros.
- Report drill-downs that pointed at `/admin?period=all&…` now go to the Telecaller drill-down and the Advisors report filtered by manager. `/admin/dashboards` still redirects to `/admin`.
- Removed `apps/web/src/lib/admin-overview.ts` (+ test): period helpers no longer used.

## Acceptance criteria
- [x] Home shows team, calling, MIS/payout and catalogue counts plus recent leads; no config/launch content.
- [x] Every figure is a passthrough from an existing summary; bank values verbatim; unknown neutral.
- [x] API e2e (dashboards suite, F-811 test: totals reconcile with raw table counts, Manager → 403).
- [x] typecheck, lint, web unit, Playwright admin-smoke (61 pass / 1 skip), zero overflow at 1440 and 390.

## Rounds 2–3 (same day, user feedback)
- "Too plain, table shows 1 row": removed the viewport lock (`lg:h-[calc(100dvh-6rem)]`) — page scrolls, table shows every row; tinted `Stat` tiles with icon + share `Meter`.
- "Team cards too big; my business is leads → cards → payout and calling performance, per date, default today": `GET /dashboards/admin/home?from&to` (`DashboardQuery`). Response: `range`, `people`, `catalogue`, `cumulative{mis,leads,payouts}` (all time), `business{leads, approved, activated, declined, inProcess, decision, activation, payouts}` (period, lead created date; payouts by eligible date — from `DashboardMetricsService.advisors`), `calling{records, calls, callbacks, outcomes, shares, byCaller, pipeline}` (period from `DashboardMetricsService.calling` + `telecallers()`; `pipeline` = all-time record statuses), `recentLeads` (period). Web: `PillNav` Today · 7 days · This month · 30 days · All time + custom dates (`lib/admin-overview.ts` restored: `PERIODS`/`resolvePeriod`, default `today`); team as one row of pills; Business hero panel (4 period tiles + All-time strip); Calling performance panel (8 period tiles + per-caller table); Recent leads.
- Consistency: approved/declined/in-process/active now use one shared rule `decisionBucket` / `activationBucket` (`@kbs/shared` status-tone.ts) in the home, `LeadsService.summary` and `MisImportService.applicationsSummary` (banks write Approve/Approved/APPROVED; the strict `statusTone` vocabulary stays for badges only).
- "Interested" on the home = outcomes `CONNECTED_INTERESTED` + `CONNECTED_LINK_OR_PDF_SHARED`.

## Follow-ups
- Endpoint returns `payouts.approvedUnpaid` / `confirmedTransfersInr` which the home does not show yet.
- Attention items (payout approvals awaiting Admin, unmatched MIS rows) were dropped from the home on purpose; they remain on their own pages.
