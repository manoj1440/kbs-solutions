# F-604 Dual approval (Manager + Admin), rejection and release

- Group: Payouts · Status: **PLANNED** · Depends on: F-603
- PRD refs: REQ-17 §17.4 (both must approve every request; itemised evidence; actor/role/decision/time/reason; Admin ≠ both; Admin-direct Advisor → designated Manager, never skipped), §17.5 (order not mandated; two records; show outstanding; rejection reason; release policy; cancel authority OPEN), REQ-15 §15.4, REQ-19 §19.1, REQ-28 P0 #4
- QA ids: PAY-03, PAY-04, PAY-07

## Detailed requirements
1. `POST /payouts/requests/:id/approvals {decision: APPROVED|REJECTED, reason?}` — role determined by actor: MANAGER (must equal `managerApproverUserId`), ADMIN. One record per role (unique); same user cannot hold both roles; Admin approving never inserts a MANAGER row. `payouts.approvalOrder=MANAGER_FIRST` optionally blocks Admin until Manager row exists.
2. Both `APPROVED` → request `APPROVED`, outbox → Accounts notification (only now). Any `REJECTED` → request `REJECTED`, items released (`ELIGIBLE_AVAILABLE`), Advisor notified with reason; the Advisor may create a new request later (resubmission policy OPEN → allowed by default, audited).
3. Approval detail view (web + mobile for Manager): itemised cards with MIS evidence (batch ref, raw activation, lastMatchedAt), rule/rate version, prior requests/payments for the same lead, warnings (entitlement UNDER_REVIEW, reference unverified).
4. Admin cancel any time before PAID (reason; releases items).

## Acceptance criteria
- [ ] PAY-03: Accounts queue empty until both rows exist.
- [ ] PAY-04: Advisor under Admin with no designated approver → request refused; with designated approver → that Manager must approve.
- [ ] Rejection releases items; audit rows for each decision.
