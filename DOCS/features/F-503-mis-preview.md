# F-503 MIS preview and anomaly report

- Group: MIS · Status: **DONE** · Depends on: F-502, F-504
- PRD refs: REQ-13 §13.4 step 3 (row count, reference coverage, blank status counts, distinct new values, probable duplicate references, probable matched leads, unmatched rows, conflicts; avoid broad PII exposure), REQ-16 §16.2 (MIS integrity)
- QA ids: MIS-01

## Detailed requirements
1. Job `mis.preview` runs matching in dry-run (F-504) and computes `previewJson`: totals, per-field blank counts, new values per field vs `knownValues`, duplicate references (same reference multiple rows), candidate matches, unmatched, conflicts, invalid; stage `PREVIEWED`.
2. Admin screen: summary tiles + tabs (new values, duplicates, unmatched sample with masked customer name — first letter + •••), "Confirm processing" button (F-505) or "Reject batch" with reason.

## Acceptance criteria
- [x] Preview never returns `CUSTOMER_NAME`, `COMPANY_NAME` or `CAPTURE_LINK` unmasked.

## Progress notes
- Implemented synchronously (no job runner yet; batches are small) in `apps/api/src/modules/mis/mis-pipeline.service.ts#preview`: runs F-504 matching, then builds `preview.report` (totals per match state, `referenceCoverage` %, `blankStatusCounts` per status field, `newValues` vs profile `knownValues`, `duplicateReferences`, masked `samples` per state). Stage → `PREVIEWED`. `POST /mis/batches/:id/preview` (MIS_IMPORT).
- PII: customer name / company / capture link are never included in the report (samples carry `maskName` only); asserted by `mis-apply.e2e-spec.ts`.
- Web: `(admin)/admin/mis/batches/[id]/pipeline.tsx` — tiles, new values with "Acknowledge as known values" (writes profile knownValues via `POST /mis/profiles/:id/known-values`), blank counts, duplicate refs, unmatched sample, then "Confirm processing (apply)". Reject remains on the batch page. Browser-checked (`scratchpad/mis-preview.png`).
