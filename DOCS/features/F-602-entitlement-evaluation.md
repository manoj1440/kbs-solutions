# F-602 Entitlement evaluation from applied MIS batches

- Group: Payouts · Status: **DONE** · Depends on: F-601, F-505, F-106 · ADR-008
- PRD refs: REQ-17 §17.1, §17.9 (available = eligible − reserved − paid), REQ-16 §16.3 (eligible vs available-to-claim), INV-05, INV-06, REQ-13 §13.6 (corrections flag financial consequence), REQ-28 P0 (duplicate/reissued card identity)
- QA ids: PAY-01, PAY-06

## Detailed requirements
1. Job `payouts.evaluate {leadId, batchId}` after apply: for the lead's bank, find approved rules in force at `batch.uploadedAt`; if `snapshot[triggerField] ∈ triggerValues` (exact text) and product pattern matches (when set) → compute `eventKey = bankId|primaryReference|triggerField|triggerValue|ruleId|ruleVersion`; upsert `PayoutEntitlement` (no-op if exists); `eligibleAt = lastMatchedAt + holdDays`; state `ELIGIBLE_AVAILABLE` once `eligibleAt ≤ now` (hold handled by a daily job + lazy check); snapshot `advisorUserId`, `reportingParentSnapshot` (current parent at that moment), `rateId/amount`; `evidenceBatchId/misRowId`.
2. Only `Lead`-backed events create entitlements; `CallingInterest` never does (INV-05).
3. If the trigger field later changes away from a trigger value (correction) → entitlement `UNDER_REVIEW` with reason; if already PAID, exception raised (F-606); nothing deleted.
4. `GET /payouts/entitlements` scoped (Advisor own; Manager team; Admin all) with state counts: eligible, available, reserved, paid, underReview.

## Acceptance criteria
- [x] Two batches reporting the same activation → one entitlement (eventKey).
- [x] Hold days delay availability; lazy check makes it available exactly at `eligibleAt` without the job.
- [x] PAY-06 (part): paid entitlement stays PAID after re-import.

## Progress notes
- `PayoutEligibilityService` (payouts module) is the only creator of `PayoutEntitlement`. Called synchronously from `MisPipelineService.apply` for every applied MATCHED row (`evaluateLead(leadId, batchId)`) and by Admin `POST /payouts/evaluate {bankId}` (re-run after a rule is approved later than the MIS). `payouts.review` / `payouts.exception` outbox events are still written for async consumers.
- Evaluation: APPROVED rules in force at `batch.uploadedAt`; exact trimmed snapshot value ∈ `triggerValues`; optional product-code regex; requires a current bank reference linkage (primary reference) — no reference → no entitlement. **`eventKey = bankId|primaryReference|triggerField|triggerValue`** (deviation from the feature text which included ruleId/version: including the rule version would double-pay the same card event after a rule edit; the rule id/version are stored on the row instead). `eligibleAt = lastMatchedAt + holdDays`; rate = `rateAt(eligibleAt)` snapshotted; state PENDING_HOLD / ELIGIBLE_AVAILABLE; `reportingParentSnapshot` = current parent (or Admin); event row + `PAYOUT_ELIGIBLE` notification (new NotificationKind, migration `20260922140000_payout_eligible_notification`).
- Corrections: open entitlements whose trigger value the bank no longer reports → `UNDER_REVIEW` with reason; value restored → back to available/hold; PAID stays PAID with a `PAID→PAID` event + `payouts.exception` outbox (deduped for identical re-imports). Nothing is ever deleted.
- Lazy hold release in `list()` (+ `releaseHolds()` for a sweep). `GET /payouts/entitlements` scoped (own/team/all/Accounts) with `meta.counts {pendingHold, available, reserved, paid, underReview, void, eligible, availableToClaim}` and `meta.amounts`; `GET /payouts/entitlements/:id/events`.
- Web: `components/entitlements-ledger.tsx` on `/admin/payouts/entitlements` and `/manager/payouts`; lead detail section D lists the lead's entitlements. Mobile: `Payouts` tab (ledger tiles + rows). Browser-checked (`scratchpad/entitlements.png`).
- Tests: `apps/api/test/payout-eligibility.e2e-spec.ts` — PAY-01, eventKey dedupe across batches, rate immutability, lazy hold, scoping, correction → UNDER_REVIEW → restore, PAY-06 PAID immutability + single exception.
