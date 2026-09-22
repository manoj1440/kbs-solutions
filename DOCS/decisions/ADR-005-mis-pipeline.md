# ADR-005: MIS import as staged, idempotent, append-only pipeline

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-13 (all), REQ-14 §14.6, INV-01/02/04/08

## Decision
`MisImportBatch.stage`: UPLOADED → PARSED (raw rows persisted as exact text) → MAPPED (profile applied, references extracted) → PREVIEWED (totals + anomalies computed, Admin sees them) → APPLYING → APPLIED | FAILED | REJECTED. Each transition is a job; each is safe to re-run.

Matching: input is `(bankId, referenceKind, referenceValue)` from the profile's ordered `referenceFields`, matched against `BankApplicationLinkage`. Zero matches → UNMATCHED; more than one lead → CONFLICT; duplicate reference with differing values in one batch → CONFLICT; both quarantined for Admin. No other signal is used.

Apply: for a MATCHED row, compare each mapped field with `BankStatusSnapshot`; write `BankStatusHistory` rows (`SET | CHANGED | CONFIRMED_SAME | REPORTED_BLANK`), update the snapshot only for non-blank values (DELTA mode) and set `lastMatchedBatchId/At`. Under FULL_SNAPSHOT, leads matched previously but absent get an `ABSENT_FROM_BATCH` history row and no value change. Identical re-upload is short-circuited by batch checksum.

After APPLIED: enqueue notifications (one per changed field group per lead, deduped by `dedupeKey = leadId:batchId`) and payout-entitlement evaluation for affected leads.

## Consequences
Raw data is always recoverable. Previews are free. The only writer of bank status is `apply.service.ts` — the INV-01 guard has a single place to protect.
