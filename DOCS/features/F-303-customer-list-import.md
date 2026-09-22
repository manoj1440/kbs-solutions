# F-303 Admin customer calling-list import

- Group: Telecaller ops · Status: **PLANNED** · Depends on: F-108, F-110, F-104, F-306
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
- [ ] CUST-01: the sample header set maps automatically; no Location column assumed.
- [ ] CUST-02: invalid/duplicate/suppressed rows reported with reasons; accepted rows allocated only to trained active Telecallers.
- [ ] CUST-03: re-import keeps assignments, suppression and call history.
- [ ] Pincode `'302001'` from a numeric cell is stored as the 6-char string; `'0'`-prefixed values keep zeros.
