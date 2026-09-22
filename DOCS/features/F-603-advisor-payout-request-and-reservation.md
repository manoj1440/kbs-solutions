# F-603 Advisor payout ledger and request creation with atomic reservation

- Group: Payouts · Status: **PLANNED** · Depends on: F-602, F-107 · ADR-008
- PRD refs: REQ-17 §17.2 (ledger columns and totals; no other Advisor's data), §17.3 (select eligible available; itemised review; atomic reservation; double-tap and two-session safety; unconfirmed/reserved/paid not selectable; store request id, advisor, reporting context, event ids, rule/rate versions, amount, time, snapshot; submitted ≠ approved), §17.8 (vocabulary), REQ-26 §26.3 steps 1–2, INV-06
- QA ids: PAY-02

## Detailed requirements
1. `GET /payouts/me/ledger` → rows per entitlement: kbsRef, bank/card, bankReference, lastMatchedAt, raw activation text, payableUnderRule (name/version), amount, position (`Available for claim | Reserved / Request submitted | Manager approval pending | Admin approval pending | Both approved / Accounts payment pending | Paid | Under review`), requestRef; totals: eligible, available, requested, approvedUnpaid, paid (count + amount).
2. `POST /payouts/requests {entitlementIds[] | all: true}` with `Idempotency-Key`: transaction → `SELECT … FOR UPDATE` entitlements where `advisorUserId=actor AND state='ELIGIBLE_AVAILABLE'`; if any requested id fails the predicate → `PAYOUT_ENTITLEMENT_NOT_AVAILABLE` (whole request refused, nothing reserved); resolve `managerApproverUserId` = current reporting parent if Manager, else `payouts.designatedApproverManagerUserId` (null → `CONFIG_MISSING` refusal, PAY-04); create `PayoutRequest(PENDING_APPROVALS, snapshot=itemised JSON)`, items, entitlements → `RESERVED`, events; outbox `payouts.request.submitted` → notifications to Manager approver and Admin.
3. Advisor cancel before any approval when `payouts.advisorCanCancelBeforeApproval` → `CANCELLED`, entitlements released.
4. Mobile screens: Payouts home (totals with provenance), ledger list with position badges, select-and-request sheet with itemised amount, request detail with two approval rows and payment status.

## Acceptance criteria
- [ ] PAY-02: two concurrent requests for the same entitlement → exactly one succeeds; partial unique index test also passes at DB level.
- [ ] Advisor never sees another Advisor's entitlements (scope test).
- [ ] Request snapshot preserved when rate later changes.
