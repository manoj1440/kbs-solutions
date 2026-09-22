# F-606 Payout reconciliation views and exception handling

- Group: Payouts · Status: **PLANNED** · Depends on: F-605, F-602
- PRD refs: REQ-17 §17.9 (same ledger across roles; approved outstanding vs paid), REQ-16 §16.2 (payout liability tile set), REQ-18 §18.3, REQ-23 §23.5, REQ-24 §24.1
- QA ids: DASH-02 (payout population), PAY-07

## Detailed requirements
1. `GET /dashboards/payouts?from&to&dateBasis=eligibleAt|submittedAt|paidAt` → eligible/reserved/approved/paid counts and amounts, request aging buckets, dual-approval backlog, missing proof, exceptions (amount mismatch, MIS correction after payment, stale requests > `payouts.requestStaleDays`).
2. Exception workflow: Admin/Accounts mark `RESOLVED` with reason (audited); no clawback/refund automation (explicitly out of scope).
3. Reconciliation test: Advisor ledger totals == Manager team totals == Admin totals for the same population.

## Acceptance criteria
- [ ] Totals reconcile across roles in fixture; date basis labelled in `meta`.
