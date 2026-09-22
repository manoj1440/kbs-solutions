# F-502 MIS upload, parse and map stages (raw preservation)

- Group: MIS · Status: **PLANNED** · Depends on: F-501, F-108, F-110
- PRD refs: REQ-13 §13.4 steps 1–2 & 4 (choose bank/profile/file/sheet; validate type, workbook, headers, identifier/status mapping, dates, row length, expected bank; reject pincode/calling workbooks; immutable file with checksum, batch id, uploader, time, per-row provenance), §13.6 (reimport same file), REQ-24 §24.1 (idempotent), §24.4
- QA ids: MIS-01, MIS-08

## Detailed requirements
1. `POST /mis/batches {bankId, profileId, fileId, sheetName?}` → checksum check: same bank + checksum already `APPLIED/APPLYING/PREVIEWED` → return that batch with `meta.duplicateOf` (no new batch). Otherwise batch `UPLOADED` and job `mis.parse`.
2. Parse: `exceljs` streaming; every cell to **text** (numbers → canonical string without scientific notation; dates → ISO text plus original display text; formulas → cached value text); row hash = SHA-256 of ordered raw cells; `MisRow.raw = {header: text}`; stage `PARSED`. Reject (stage `REJECTED`, reason) when required reference/status headers are absent — e.g. a pincode sheet or calling list.
3. Map: apply profile → `mapped` (internal field → text), parse dates with profile formats/timezone into `mappedDates` (keep text), extract `referenceValues` in profile order; stage `MAPPED`. Rows with no usable reference → `matchState=INVALID reason=NO_REFERENCE`.
4. All stages idempotent (re-running parse deletes and rewrites rows of that batch only if not yet APPLIED).

## Acceptance criteria
- [ ] MIS-08 (part): identical file re-upload returns existing batch; no new rows.
- [ ] A cell `0012345` stays `"0012345"`; `1.2E+7` becomes `"12000000"`.
- [ ] Uploading the pincode fixture as MIS → REJECTED with explicit reason.
