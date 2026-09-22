# F-505 MIS apply: snapshot, change history, delta/full semantics, idempotency

- Group: MIS · Status: **DONE** · Depends on: F-504, F-110 · ADR-005
- PRD refs: REQ-13 §13.1 (only latest valid accepted row updates bank fields; never overwrite from KBS events), §13.4 steps 5–7, §13.6 (all nine conditions), §13.8 (date provenance), REQ-14 §14.6 (history grouped by batch; identical repeat no fake transition; notification wording), INV-01, INV-02, INV-04, REQ-26 §26.2 steps 6–7
- QA ids: MIS-02, MIS-03, MIS-05, MIS-07, MIS-08, MIS-10

## Detailed requirements
1. `POST /mis/batches/:id/apply` (Admin) → stage `APPLYING`, job `mis.apply` in `withMisApplyContext()` (the only code allowed to write bank status).
2. Per MATCHED row, per mapped field: compare text with snapshot; write `BankStatusHistory` with `changeKind`: `SET` (was null), `CHANGED` (differs), `CONFIRMED_SAME`, `REPORTED_BLANK` (cell blank/#N/A). Update snapshot field only when non-blank (or when `blankOverwrites=true`). Set `rawLatest`, `lastMatchedBatchId`, `lastMatchedAt=batch.uploadedAt` (KBS receipt time), `firstMatchedAt` if null. Reported event dates (`finalDecisionDate`, etc.) come from the row, never from upload time.
3. FULL_SNAPSHOT mode: leads matched in an earlier batch of the same bank but absent now → history `ABSENT_FROM_BATCH`; snapshot values untouched; `lastMatchedAt` unchanged (MIS-05).
4. Batch totals: `updatedChanged`, `updatedNoChange`, `unmatched`, `conflicts`, `invalid`, `needsReview`; stage `APPLIED`, `appliedAt`.
5. Post-apply outbox events: `mis.lead.changed {leadId, batchId, changedFields}` (only when at least one `SET|CHANGED`) → notifications (F-701) and payout evaluation (F-602). Identical re-processing creates no events (MIS-08).
6. Retroactive corrections (MIS-10): a later batch with different values simply produces `CHANGED` rows with both batch references; if the changed field is a payout trigger field and an entitlement exists, emit `payouts.review {entitlementId}` → `UNDER_REVIEW` (F-606), never delete payment history.
7. Failure mid-apply: job retries from the last unprocessed row (row-level `appliedAt`); batch never half-published as APPLIED.

## Acceptance criteria
- [x] MIS-02: three fields stored and returned independently and verbatim.
- [x] MIS-03: `#N/A` activation → snapshot null, history `REPORTED_BLANK`, display "Not reported".
- [x] MIS-07: any other module's attempt to write the snapshot throws (INV-01).
- [x] MIS-08: applying the same batch twice → no new history rows/events.
- [x] MIS-10: correction produces new history with reported date ≠ upload time.

## Progress notes
- `apply(actor, batchId, {onlyRowIds?})` runs inside `withMisApplyContext(batchId)` (INV-01 guard in `@kbs/db`; MIS-07 test proves other writers throw). Synchronous today; row-level `appliedAt` makes re-runs resume from unprocessed rows (req 7 — retry via re-calling apply; `FAILED` stage re-appliable).
- Per field: `BankStatusHistory` upsert on unique `(leadId, batchId, field)` with SET / CHANGED / CONFIRMED_SAME / REPORTED_BLANK; blank never overwrites (no `blankOverwrites` config yet — documented gap, default false semantics). Reported dates come from row `mappedDates` (`creationDateTime→bankCreationDateTime`, `finalDecisionDate`, `vkycConsentDate`, `vkycExpiryDate`); `lastMatchedAt = batch.uploadedAt`.
- FULL_SNAPSHOT: leads matched by an earlier batch of the same bank but absent now → history `ABSENT_FROM_BATCH` (field `*`), snapshot untouched (MIS-05).
- Outbox: `mis.lead.changed` only when ≥1 SET|CHANGED; `payouts.review` when `finalDecision`/`cardActivationStatus` change and an entitlement exists (consumer lands in F-606). Notifications `MIS_CHANGED` (per lead owner) and `MIS_IMPORT_RESULT` (admin).
- `GET /leads/:id/mis-history` grouped by batch (consumed by F-408 UI). Tests: `apps/api/test/mis-apply.e2e-spec.ts` (MIS-02/03/05/07/08/09/10). Browser-checked apply on the batch page (`scratchpad/mis-applied.png`).
