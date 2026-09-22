# F-505 MIS apply: snapshot, change history, delta/full semantics, idempotency

- Group: MIS · Status: **PLANNED** · Depends on: F-504, F-110 · ADR-005
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
- [ ] MIS-02: three fields stored and returned independently and verbatim.
- [ ] MIS-03: `#N/A` activation → snapshot null, history `REPORTED_BLANK`, display "Not reported".
- [ ] MIS-07: any other module's attempt to write the snapshot throws (INV-01).
- [ ] MIS-08: applying the same batch twice → no new history rows/events.
- [ ] MIS-10: correction produces new history with reported date ≠ upload time.
