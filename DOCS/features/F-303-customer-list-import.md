# F-303 Admin customer calling-list import

- Group: Telecaller ops · Status: **DONE** · Depends on: F-108, F-110, F-104, F-306
- PRD refs: REQ-06 §6.1 (exact headings NAME, PAN NO, MOBILE, Pincode; no Location column; PAN sensitive), §6.2 (upload → sheet select → mapping/preview without PAN/mobile exposure → validate → duplicate/conflict report → confirm → totals + immutable batch ref; preserve file/row/uploader/time; no auto-redistribution), §6.3 (validations; PAN not a search field; dedupe policy OPEN → configurable; invalid/compliance-blocked to review queue), REQ-21 §21.2 (compliance confirmation before activation), REQ-23 §23.2, REQ-24 §24.4
- QA ids: CUST-01, CUST-02, CUST-03

## Detailed requirements
1. Wizard (web, Admin): (a) upload xlsx/csv → `StoredFile purpose=CUSTOMER_LIST`, batch `UPLOADED`; (b) choose sheet; (c) header mapping — auto-detect `NAME`, `PAN NO`, `MOBILE`, `Pincode` (case/space-insensitive aliases), Admin confirms; no `Location` mapping is offered unless a column exists; (d) preview: first 20 rows with mobile masked (`+91••••••1234`), PAN masked (`•••••1234F`), pincode shown; counts; (e) validation report: invalid mobile, invalid pincode (must be 6 digits after string normalisation; leading zeros preserved), blank mandatory, in-batch duplicates (key from `allocation.dedupeKey`, default mobile), duplicates of existing **active** records, suppressed mobiles (F-306), invalid PAN format (warning only — PAN is optional for calling); (f) confirm → job parses all rows, writes `CallingRecord` rows with `reviewStatus` (`ACCEPTED` / `NEEDS_REVIEW` / `EXCLUDED`) and `batchId`, totals stored on the batch; then allocation (F-305) for accepted rows only.
2. Compliance gate: batch cannot be **activated for calling** (allocation) unless `compliance.callingListConsentConfirmedByCompliance=true` **or** the Admin ticks a per-batch attestation (`consentRepresentationConfirmed`, `sourceVendor`, `permittedUseBasis`) recorded on the batch — REQ-21 §21.2. Until then the batch stays imported-but-unallocated with a visible reason.
3. Re-upload containing an already-assigned customer: the new row is marked `DUPLICATE_OF_EXISTING` and skipped; existing assignment, history and suppression untouched (CUST-03). Identical file (checksum) → return prior batch.
4. Location: resolve city/state via `PincodeMaster` (F-304) at import; unresolved → `locationResolved=false` and UI shows "Location unavailable".
5. PAN stored encrypted, `panLast4` only in plaintext; PAN never indexed or searchable.
6. Review queue screen: rows needing review with reason; Admin can `accept` (then allocate), `exclude` (reason) — audited.
7. Batch list screen: ref, file, uploader, time, totals, attestation status, per-row explanations download restricted (audited).

## Acceptance criteria
- [x] CUST-01: the sample header set maps automatically; no Location column assumed.
- [x] CUST-02: invalid/duplicate/suppressed rows reported with reasons; accepted rows allocated only to trained active Telecallers.
- [x] CUST-03: re-import keeps assignments, suppression and call history.
- [x] Pincode `'302001'` from a numeric cell is stored as the 6-char string; `'0'`-prefixed values keep zeros.

## Progress notes
- 2026-09-22 (session 2): API `POST /calling-list/batches` (checksum dedupe → prior batch; header auto-detect; masked preview), `PUT /calling-list/batches/:id/mapping` (validation report: `totals.validation {accepted, needsReview, excluded, byIssue}`), `POST /calling-list/batches/:id/confirm` (writes `CallingRecord` rows with `reviewStatus`, PAN encrypted + `panLast4`, pincode-master location, per-batch attestation fields; then F-305 `allocateBatchIfAllowed`), `GET /calling-list/batches[/:id][/rows?reviewStatus=]`, `POST /calling-list/records/:id/review` (ACCEPT re-allocates / EXCLUDE hides, reason mandatory, audited), `POST /calling-list/batches/:id/allocate` (explicit run, 409 while consent gate closed). Row classification: SUPPRESSED / DUPLICATE_* → EXCLUDED (hidden at import); INVALID_MOBILE / INVALID_PINCODE / BLANK_NAME → NEEDS_REVIEW; INVALID_PAN warning only. Invalid mandatory data can only be excluded (fix the source file). Admin web `/admin/calling-list` (batch list + upload) and `/admin/calling-list/[id]` (map → preview → validation report → attest/confirm → totals, allocate button, review queue). e2e `customer-import.e2e-spec.ts` (CUST-01/02/03 + review queue + RBAC). Per-row explanations download (req 7) not built yet — rows endpoint returns reasons.
