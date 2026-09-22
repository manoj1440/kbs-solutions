# F-310 Call outcomes, operational remarks, follow-up/hide, calling interest

- Group: Telecaller ops · Status: **DONE** · Depends on: F-309, F-306
- PRD refs: REQ-08 §8.6 (taxonomy: no answer/unreachable/technical failure; connected+interested; connected+link/PDF shared; callback/follow-up; declined; completed; remarks; Admin may refine taxonomy without bank-stage values; reason required for follow-up/declined if configured; hide not delete; do-not-contact suppression), §8.7 (operational lead/interest; no payout; collision OPEN → flag only), REQ-14 §14.5 (operational remarks with author + edit history), INV-05
- QA ids: CALL-04, CUST-04

## Detailed requirements
1. `POST /calling/records/:id/outcomes {callAttemptId?, outcome, remarks?, followUpAt?, selectedCardId?, doNotContact?}`: validation per config (reason for FOLLOW_UP/DECLINED); effects on `CallingRecord.interactionStatus`, `nextFollowUpAt`, `hiddenAt` (DECLINED/COMPLETED hide; UNREACHABLE/INTERESTED/FOLLOW_UP keep active); `doNotContact` → suppression (F-306).
2. `CallingInterest` created when outcome is `CONNECTED_LINK_OR_PDF_SHARED` with a card (or explicitly via share action F-311) — visible in Manager/Admin analytics; carries no entitlement (INV-05 test).
3. Outcome taxonomy stored as a versioned list in config (`calling.outcomeTaxonomyVersion`) — Admin can add operational labels but the enum of *kinds* is fixed and none maps to a bank stage.
4. `OperationalRemark` with edit history (append, never overwrite); shown separately from any MIS text.
5. Collision flag: if a `Lead` exists with the same mobile (exact) as a calling record with an interest, mark both with `possibleCollision=true` for Manager/Admin review; no attribution change (OPEN).
6. Manager/Admin see attempts, outcomes, remarks, interests per Telecaller (feeds F-313/F-702).

## Acceptance criteria
- [x] CALL-04: recording an outcome never touches any `BankStatusSnapshot` (guard) and creates no `PayoutEntitlement`.
- [x] CUST-04: DECLINED hides; FOLLOW_UP with date stays visible with due date; hidden rows retrievable.
- [x] Remark edit keeps prior text in `editHistory`.

## Progress notes
- 2026-09-22 (session 2): `OutcomesService.record` (`POST /calling/records/:id/outcomes`, own record only): kind → effect map (NO_ANSWER_OR_FAILED→UNREACHABLE, CONNECTED_INTERESTED→INTERESTED, CONNECTED_LINK_OR_PDF_SHARED→LINK_SHARED, FOLLOW_UP→FOLLOW_UP+nextFollowUpAt, DECLINED/COMPLETED_NO_FURTHER→hidden); FOLLOW_UP needs a future `followUpAt` and (per `calling.requireReasonForFollowUp`) a note; DECLINED needs a note per `calling.requireReasonForDecline`; `callAttemptId` must belong to the record+actor; `selectedCardId` must be PUBLISHED; interest kinds with a card create `CallingInterest` and set `possibleCollision` on both sides when an Advisor `Lead` has the same mobile (no attribution change); `doNotContact` → `SuppressionService.suppress(CUSTOMER_REQUEST)`; hidden records refuse further outcomes. `OUTCOME_LABELS` in shared are the operational labels (kinds fixed, none is a bank stage). Remarks: `GET/POST /calling/records/:id/remarks`, `PUT /remarks/:id` (author or Admin; prior text appended to `editHistory`). e2e proves no `PayoutEntitlement`/`BankStatusSnapshot`/`Lead` is created by any outcome (INV-05).
