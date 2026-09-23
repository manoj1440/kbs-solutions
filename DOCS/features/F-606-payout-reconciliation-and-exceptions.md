# F-606 Payout reconciliation views and exception handling

- Group: Payouts · Status: **DONE** · Depends on: F-605, F-602
- PRD refs: REQ-17 §17.9 (same ledger across roles; approved outstanding vs paid), REQ-16 §16.2 (payout liability tile set), REQ-18 §18.3, REQ-23 §23.5, REQ-24 §24.1
- QA ids: DASH-02 (payout population), PAY-07

## Detailed requirements
1. `GET /dashboards/payouts?from&to&dateBasis=eligibleAt|submittedAt|paidAt` → eligible/reserved/approved/paid counts and amounts, request aging buckets, dual-approval backlog, missing proof, exceptions (amount mismatch, MIS correction after payment, stale requests > `payouts.requestStaleDays`).
2. Exception workflow: Admin/Accounts mark `RESOLVED` with reason (audited); no clawback/refund automation (explicitly out of scope).
3. Reconciliation test: Advisor ledger totals == Manager team totals == Admin totals for the same population.

## Acceptance criteria
- [x] Totals reconcile across roles in fixture; date basis labelled in `meta`.

## Progress notes
- One classifier (`apps/api/src/modules/payouts/ledger-buckets.ts`: pendingHold, available, requested, approvedUnpaid, onHold, paid, underReview, void; eligible = MIS-eligible union) now drives both the Advisor ledger and `GET /dashboards/payouts`, so figures reconcile by construction. The ledger gained an `onHold` total.
- `GET /dashboards/payouts?from&to&dateBasis=eligibleAt|submittedAt|paidAt&bankId&managerId&advisorId` (Admin, Accounts, Manager — Manager scoped to direct team; out-of-scope filters → 404): bucket totals, confirmed transfers (recorded amounts of PAID requests, not approved totals), dual-approval backlog with aging (0–7/8–14/15–30/31+ days) and outstanding Manager/Admin counts, missing proof, exceptions summary; `meta.dateBasis`, range, `staleDays`, scope, source.
- Exceptions are derived on read (`GET /payouts/exceptions`): PAYMENT_EXCEPTION, CORRECTION_PENDING, DISCREPANCY_HOLD, MISSING_PROOF (resolved through the F-605 flows, shown with `resolvedVia`), STALE_REQUEST (> `payouts.requestStaleDays`, never auto-cancelled), MIS_CORRECTION_AFTER_PAYMENT (F-602 PAID→PAID event), UNDER_REVIEW_IN_REQUEST. Only STALE_REQUEST and MIS_CORRECTION_AFTER_PAYMENT are acknowledged via `POST /payouts/exceptions/resolve {kind, subjectId, reason}` (Admin/Accounts, audited `payoutException.resolve`, stored in `PayoutExceptionResolution`); acknowledging never changes money state — no clawback/refund automation.
- Web: `/admin/payouts/liability`, `/manager/payouts/liability`, `/accounts/reconciliation` (shared `PayoutDashboard` component) with date-basis label, amber exception banner, tiles, backlog aging and the exceptions table. Browser-checked at 1280 (Admin) and 390 (Accounts, no overflow).
- Tests: `apps/api/test/payout-reconciliation.e2e-spec.ts` — three Advisors in two teams covering every bucket: Advisor ledger == Manager == Admin == Accounts per Advisor, team sums == Admin `managerId` filter, all == sum of ledgers; paid basis; scoping 404/403; exception derivation, acknowledgement, duplicate 409, audit rows, money state unchanged.
- Tooling: `packages/db/scripts/wasm-diff.mjs` generates incremental migration SQL offline.
