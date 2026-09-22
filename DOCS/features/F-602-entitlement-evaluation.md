# F-602 Entitlement evaluation from applied MIS batches

- Group: Payouts · Status: **PLANNED** · Depends on: F-601, F-505, F-106 · ADR-008
- PRD refs: REQ-17 §17.1, §17.9 (available = eligible − reserved − paid), REQ-16 §16.3 (eligible vs available-to-claim), INV-05, INV-06, REQ-13 §13.6 (corrections flag financial consequence), REQ-28 P0 (duplicate/reissued card identity)
- QA ids: PAY-01, PAY-06

## Detailed requirements
1. Job `payouts.evaluate {leadId, batchId}` after apply: for the lead's bank, find approved rules in force at `batch.uploadedAt`; if `snapshot[triggerField] ∈ triggerValues` (exact text) and product pattern matches (when set) → compute `eventKey = bankId|primaryReference|triggerField|triggerValue|ruleId|ruleVersion`; upsert `PayoutEntitlement` (no-op if exists); `eligibleAt = lastMatchedAt + holdDays`; state `ELIGIBLE_AVAILABLE` once `eligibleAt ≤ now` (hold handled by a daily job + lazy check); snapshot `advisorUserId`, `reportingParentSnapshot` (current parent at that moment), `rateId/amount`; `evidenceBatchId/misRowId`.
2. Only `Lead`-backed events create entitlements; `CallingInterest` never does (INV-05).
3. If the trigger field later changes away from a trigger value (correction) → entitlement `UNDER_REVIEW` with reason; if already PAID, exception raised (F-606); nothing deleted.
4. `GET /payouts/entitlements` scoped (Advisor own; Manager team; Admin all) with state counts: eligible, available, reserved, paid, underReview.

## Acceptance criteria
- [ ] Two batches reporting the same activation → one entitlement (eventKey).
- [ ] Hold days delay availability; lazy check makes it available exactly at `eligibleAt` without the job.
- [ ] PAY-06 (part): paid entitlement stays PAID after re-import.
