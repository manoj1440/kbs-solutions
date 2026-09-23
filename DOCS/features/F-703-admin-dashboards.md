# F-703 Admin dashboards (executive, telecaller, manager, advisor, bank/card mix, payouts)

- Group: Dashboards & notifications · Status: **DONE** · Depends on: F-702, F-507, F-606
- PRD refs: REQ-16 §16.2 (eight dashboards), §16.3 (formulas & guardrails; label date basis; never imply live bank status), REQ-01 §1.3, REQ-20 §20.4 (never hide conflicts behind green KPI)
- QA ids: DASH-01, DASH-02

## Detailed requirements
1. Read-model SQL views (migration) for: call metrics, share metrics, lead counts, MIS distributions, entitlement states — each with population keys (period, manager, telecaller, advisor, bank, card).
2. Endpoints per dashboard with filters; `meta.dateBasis` and `meta.misFreshness` (per-bank last applied batch) in responses.
3. Web pages: Executive overview (tiles + per-bank freshness strip + launch-gate checklist), Telecaller performance, Manager performance, Advisor performance, Bank/card mix, Payout liability (F-606), MIS integrity (F-507), Audit (F-704).
4. Any conflict/unmatched count > 0 shows an amber banner on the executive page (never hidden).

## Acceptance criteria
- [x] Fixture-based equality between dashboard figures and raw table counts.

## Progress notes
- Built on the F-702 engine (`DashboardMetricsService`) plus `AdminDashboardsService` (`apps/api/src/modules/dashboards/`). Endpoints (DASHBOARD_ADMIN): `GET /dashboards/admin/executive` (F-702 sections + `alerts` + `launchGates`), `/admin/telecallers`, `/admin/managers`, `/admin/advisors` (per-person rows, evidence only — no score or ranking, REQ-15 §15.3), `/admin/bank-card-mix` (leads, MIS matched / awaiting, payout eligible / paid per bank × card). All take the `DashboardQuery` filters; `meta` carries date bases and per-bank MIS freshness.
- Executive alerts are always shown when non-zero (REQ-20 §20.4): unmatched MIS rows, conflicting MIS rows, open payout exceptions (F-606), open launch gates, active banks with no applied MIS.
- **Deviation (recorded):** requirement 1 asked for read-model SQL views; figures are computed on read from indexed base tables through one service, which already guarantees Manager/Admin/per-person equality. Materialised views are deferred to F-905 if the measured thresholds need them.
- Web: `/admin/dashboards` (executive, shared `OperationsDashboard` with the amber "Needs attention" banner), `/admin/dashboards/{telecallers,managers,advisors,bank-card-mix}`, and a tab row (`AdminDashboardNav`) linking all eight REQ-16 §16.2 dashboards incl. payout liability (F-606), MIS integrity (F-507) and audit (F-704). Sidebar group "Dashboards". Browser-checked at 1280 and 390 px.
- Tests (`dashboards.e2e-spec.ts`): per-telecaller sums == executive attempts, per-manager sums == executive leads, advisor rows, bank/card mix row counts, alert appears when an unmatched MIS row exists, executive `?managerId` == that Manager's own dashboard, 403 for non-Admin.
