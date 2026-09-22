# F-503 MIS preview and anomaly report

- Group: MIS · Status: **PLANNED** · Depends on: F-502, F-504
- PRD refs: REQ-13 §13.4 step 3 (row count, reference coverage, blank status counts, distinct new values, probable duplicate references, probable matched leads, unmatched rows, conflicts; avoid broad PII exposure), REQ-16 §16.2 (MIS integrity)
- QA ids: MIS-01

## Detailed requirements
1. Job `mis.preview` runs matching in dry-run (F-504) and computes `previewJson`: totals, per-field blank counts, new values per field vs `knownValues`, duplicate references (same reference multiple rows), candidate matches, unmatched, conflicts, invalid; stage `PREVIEWED`.
2. Admin screen: summary tiles + tabs (new values, duplicates, unmatched sample with masked customer name — first letter + •••), "Confirm processing" button (F-505) or "Reject batch" with reason.

## Acceptance criteria
- [ ] Preview never returns `CUSTOMER_NAME`, `COMPANY_NAME` or `CAPTURE_LINK` unmasked.
