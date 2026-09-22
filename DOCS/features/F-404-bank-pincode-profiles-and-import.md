# F-404 Bank-specific pincode profiles, import and sourceability

- Group: Advisor · Status: **DONE** · Depends on: F-108, F-110, F-403
- PRD refs: REQ-07 §7.2 (nine sheet structures with exact headers and required treatments), §7.3 (reviewed header mappings; pincode as 6-char string; version per bank; preserve original flags; ambiguous → 'Requires bank mapping'; never merge into universal schema without raw rows), §7.4, REQ-28 §28.2 (all sample schemas must pass import QA)
- QA ids: PIN-01, PIN-02, PIN-03

## Detailed requirements
1. `BankPincodeProfile` per bank + version: sheet name, header aliases, `pincodeColumn`, and `semantics` rules evaluated per row to derive `sourceability`:
   - EQUITAS: pincode `SOURCING PINCODE`; preserve branch codes/remarks; sourceable if pincode present (remark never implies success).
   - IDFC: `MASTER_PINCODES_NAME` must be validated as the pincode column; `NTB` preserved.
   - HSBC: sourceable only if `STATUS`/`PINCODEFLAG`/`CARDDELIVERYFLAG` satisfy the Admin-confirmed rule; default **REQUIRES_BANK_MAPPING** until the rule is set.
   - INDUSIND: `Pincode`, keep `Branch SOL ID`, `Added on`.
   - RBL: `Sourceable` (Y/N) governs; `Is Online City` preserved separately, never equated.
   - AU: `CUST_PINCODE`, `CUST_STATE`.
   - YES: `PINCODE`; keep `Policy`, `ICL/OCL`; ignore empty auto-generated columns after validation.
   - AXIS: `pincode`; `pincode_type`, `address_type` rules default REQUIRES_BANK_MAPPING.
   - SBI: `pincode`; `source_code` semantics unconfirmed → preserved, not used as filter.
   Seed all nine profiles as **DRAFT** (unapproved) with these mappings; Admin approves after review.
2. Import wizard: upload → choose sheet → mapping check against profile (unknown/missing headers surfaced) → preview (counts, distinct flag values) → confirm → job writes `BankPincodeRow` with `raw` (exact header→text) and derived sourceability; batch versioned; previous batch remains for history; the **latest APPLIED batch under an APPROVED profile** is what F-308 reads.
3. Pincode cells read as text; numeric cells zero-padded to 6 only when the profile flag `padNumericPincodes=true` (default true) — recorded per row `wasPadded`.
4. Admin screens: Profiles (per bank, status, version, mapping editor with semantics rule builder), Batches, Row explorer with raw view (audited).

## Acceptance criteria
- [x] PIN-01: fixture workbook with the nine sheets imports with original fields preserved in `raw`.
- [x] PIN-02: HSBC rows default to REQUIRES_BANK_MAPPING and never appear as available.
- [x] PIN-03: `'000123'` preserved; lookup matches exact string.

## Progress notes
- 2026-09-22 (session 2): API `GET/PATCH /pincode-profiles[/:id]` (DRAFT edited in place; editing APPROVED creates next DRAFT version), `POST /pincode-profiles/:id/approve` (retires the previous APPROVED version of that bank), `POST /pincode-profiles/:id/batches` (header check: missing/unknown/pincodePresent surfaced; identical file → prior batch; preview with counts, distinct values of preserved/flag columns, sample), `POST /pincode-batches/:id/confirm` (409 when header check failed; writes `BankPincodeRow` with exact `raw`, `wasPadded`, sourceability), `GET /pincode-batches/:id/rows` (audited read `pincodeBatch.rowsViewed`), `GET /sourceability/:pincode` (per bank: latest IMPORTED batch under the APPROVED profile; multiple rows → SOURCEABLE > REQUIRES_BANK_MAPPING > NOT). Rules: `PRESENT_PINCODE_IS_SOURCEABLE`, `FLAG_EQUALS {column,trueValues}` (blank flag → REQUIRES_BANK_MAPPING), `REQUIRES_BANK_MAPPING` (`evaluateSourceability` is pure). Seed `headerMapping` is now `{ headers: [...] }` (old `{h: h}` rows still read). Admin web `/admin/pincode-profiles` + `[id]` (mapping/rule editor, approve, batch upload → header check → preview → confirm, batches, audited row explorer). e2e PIN-01/02/03 with a nine-sheet fixture workbook + header-mismatch case.
