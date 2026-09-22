# F-603 Advisor payout ledger and request creation with atomic reservation

- Group: Payouts · Status: **DONE** · Depends on: F-602, F-107 · ADR-008
- PRD refs: REQ-17 §17.2 (ledger columns and totals; no other Advisor's data), §17.3 (select eligible available; itemised review; atomic reservation; double-tap and two-session safety; unconfirmed/reserved/paid not selectable; store request id, advisor, reporting context, event ids, rule/rate versions, amount, time, snapshot; submitted ≠ approved), §17.8 (vocabulary), REQ-26 §26.3 steps 1–2, INV-06
- QA ids: PAY-02

## Detailed requirements
1. `GET /payouts/me/ledger` → rows per entitlement: kbsRef, bank/card, bankReference, lastMatchedAt, raw activation text, payableUnderRule (name/version), amount, position (`Available for claim | Reserved / Request submitted | Manager approval pending | Admin approval pending | Both approved / Accounts payment pending | Paid | Under review`), requestRef; totals: eligible, available, requested, approvedUnpaid, paid (count + amount).
2. `POST /payouts/requests {entitlementIds[] | all: true}` with `Idempotency-Key`: transaction → `SELECT … FOR UPDATE` entitlements where `advisorUserId=actor AND state='ELIGIBLE_AVAILABLE'`; if any requested id fails the predicate → `PAYOUT_ENTITLEMENT_NOT_AVAILABLE` (whole request refused, nothing reserved); resolve `managerApproverUserId` = current reporting parent if Manager, else `payouts.designatedApproverManagerUserId` (null → `CONFIG_MISSING` refusal, PAY-04); create `PayoutRequest(PENDING_APPROVALS, snapshot=itemised JSON)`, items, entitlements → `RESERVED`, events; outbox `payouts.request.submitted` → notifications to Manager approver and Admin.
3. Advisor cancel before any approval when `payouts.advisorCanCancelBeforeApproval` → `CANCELLED`, entitlements released.
4. Mobile screens: Payouts home (totals with provenance), ledger list with position badges, select-and-request sheet with itemised amount, request detail with two approval rows and payment status.

## Acceptance criteria
- [x] PAY-02: two concurrent requests for the same entitlement → exactly one succeeds; partial unique index test also passes at DB level.
- [x] Advisor never sees another Advisor's entitlements (scope test).
- [x] Request snapshot preserved when rate later changes.

## Progress notes
- `PayoutRequestsService` (payouts module). `GET /payouts/me/ledger` (and `/payouts/ledger/:advisorId` for Manager/Admin/Accounts): one row per entitlement with the §17.8 `position` (`PayoutRequestsService.position()` derives it from entitlement + request + approval rows), kbsRef, bank/card, bank reference, lastMatchedAt, raw activation text, rule/version, amount, evidence batch, request ref; totals eligible / available / requested / approvedUnpaid / paid / underReview / pendingHold (count + amount).
- `POST /payouts/requests {entitlementIds[] | all}` (PAYOUT_REQUEST, Idempotency-Key also stored as `PayoutRequest.idempotencyKey` → replay): one transaction — `SELECT … FOR UPDATE` on the advisor's entitlements, whole request refused with `PAYOUT_ENTITLEMENT_NOT_AVAILABLE` if any selected id is not ELIGIBLE_AVAILABLE (nothing reserved); Manager approver = current active Manager parent, else `payouts.designatedApproverManagerUserId` (must be an active Manager) else `CONFIG_MISSING`; request `PENDING_APPROVALS` with itemised `snapshot` (event keys, rule/rate ids + versions, amounts), items, entitlements → RESERVED, events, outbox `payouts.request.submitted`; notifications to Manager approver, Admin, Advisor (“submitted ≠ approved”).
- Advisor cancel before any approval when `payouts.advisorCanCancelBeforeApproval` (`POST /payouts/requests/:id/cancel`), releases items.
- Mobile Advisor `Payouts` tab rebuilt on the ledger: totals with provenance line, select / select-all-available, itemised confirm sheet, idempotent submit (same key on double tap), My requests list, ledger rows with position badges; `payout-request` detail screen (shared `components/payout-request-detail.tsx`: approval rows, payment, cancel).
- Tests: `apps/api/test/payout-requests.e2e-spec.ts` — PAY-02 concurrency (exactly one of two simultaneous requests succeeds), non-available selection refused with nothing reserved, idempotent replay, DB partial-unique guard, advisor scope, snapshot immutable after rate change.
