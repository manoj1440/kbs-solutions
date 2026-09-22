# F-502 MIS upload, parse and map stages (raw preservation)

- Group: MIS · Status: **DONE** · Depends on: F-501, F-108, F-110
- PRD refs: REQ-13 §13.4 steps 1–2 & 4 (choose bank/profile/file/sheet; validate type, workbook, headers, identifier/status mapping, dates, row length, expected bank; reject pincode/calling workbooks; immutable file with checksum, batch id, uploader, time, per-row provenance), §13.6 (reimport same file), REQ-24 §24.1 (idempotent), §24.4
- QA ids: MIS-01, MIS-08

## Detailed requirements
1. `POST /mis/batches {bankId, profileId, fileId, sheetName?}` → checksum check: same bank + checksum already `APPLIED/APPLYING/PREVIEWED` → return that batch with `meta.duplicateOf` (no new batch). Otherwise batch `UPLOADED` and job `mis.parse`.
2. Parse: `exceljs` streaming; every cell to **text** (numbers → canonical string without scientific notation; dates → ISO text plus original display text; formulas → cached value text); row hash = SHA-256 of ordered raw cells; `MisRow.raw = {header: text}`; stage `PARSED`. Reject (stage `REJECTED`, reason) when required reference/status headers are absent — e.g. a pincode sheet or calling list.
3. Map: apply profile → `mapped` (internal field → text), parse dates with profile formats/timezone into `mappedDates` (keep text), extract `referenceValues` in profile order; stage `MAPPED`. Rows with no usable reference → `matchState=INVALID reason=NO_REFERENCE`.
4. All stages idempotent (re-running parse deletes and rewrites rows of that batch only if not yet APPLIED).

## Acceptance criteria
- [x] MIS-08 (part): identical file re-upload returns existing batch; no new rows.
- [x] A cell `0012345` stays `"0012345"`; `1.2E+7` becomes `"12000000"`.
- [x] Uploading the pincode fixture as MIS → REJECTED with explicit reason.

## Progress notes
- 2026-09-22 (session 3): `MisImportService.create` (`POST /mis/batches {bankId, profileId, fileId, sheetName?}`, MIS_IMPORT, idempotent): profile must be APPROVED for that bank; same bank + checksum already parsed/applied → returns that batch with `duplicateOf`; header check requires ≥1 reference column and ≥1 status column (CURRENT_STAGE/FINAL_DECISION/Card Activation Staus) else stage REJECTED with an explicit reason (pincode sheets and calling lists fail here); missing selector sheet falls back to the first sheet. Parse+map run inline (jobs later if volumes need it): every cell text via the shared tabular parser (numbers canonical, no sci-notation; dates ISO), `rowHash` = SHA-256 of the ordered raw cells, identical duplicate rows dropped and counted, `MisRow.raw` exact, `mapped` internal→text, `mappedDates {text, iso}` via `parseBankDate` (profile formats, IST), `referenceValues` in profile order (trim ends only); rows without any reference → INVALID `NO_REFERENCE`; stage MAPPED with totals (rows, unique, duplicateRows, invalid, missingHeaders, unmappedColumns). `GET /mis/batches[?bankId&stage]`, `GET /mis/batches/:id`, `GET /mis/batches/:id/rows?matchState&reveal` (CUSTOMER_NAME/COMPANY_NAME/CAPTURE_LINK masked unless reveal + MIS_RAW_ROW_VIEW; reveal logged as `MIS_RAW_ROW` sensitive access), `POST /mis/batches/:id/reject`. Admin web `/admin/mis/batches/[id]` (parse summary, rows table with state filter, PII reveal toggle, reject). Public ref prefix `KBS-M-`.
