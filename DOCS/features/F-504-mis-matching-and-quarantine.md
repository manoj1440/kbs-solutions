# F-504 Deterministic MIS matching, quarantine and Admin resolution

- Group: MIS · Status: **DONE** · Depends on: F-502, F-407 · ADR-005, ADR-007
- PRD refs: REQ-13 §13.5 (bank + exact reference; preserve strings; no name/mobile/PAN/date/product/similarity matching; disagreeing/reused/missing/multi-lead → quarantine), §13.4 step 6 (row-level explanations; audited correction), §13.6 rows 6–7, INV-08, REQ-26 §26.4
- QA ids: MIS-09

## Detailed requirements
1. Matcher input per row: `(bankId, [(kind, value)…])`. Look up `BankApplicationLinkage` by exact `(bankId, kind, value)` for each reference in profile order. Outcomes: exactly one distinct lead across all references → `MATCHED`; none → `UNMATCHED`; two references pointing to different leads → `CONFLICT reason=REFERENCE_DISAGREEMENT`; same reference on ≥2 rows in the batch with different mapped values → all such rows `CONFLICT reason=DUPLICATE_IN_BATCH_DIVERGENT`; identical duplicate rows → keep one, others `DUPLICATE_IN_BATCH`.
2. `matchExplanation` text stored per row.
3. Resolution API (Admin, `MIS_RESOLVE`): `POST /mis/rows/:id/resolve {action: LINK_TO_LEAD(leadId, referenceKind) | IGNORE(reason) | PREFER_ROW(rowId) for divergent duplicates}` — linking creates `BankApplicationLinkage(source=MIS_RESOLVED_BY_ADMIN, verificationStatus=VERIFIED_BY_MIS_MATCH)` and re-queues apply for that row; every action audited with before/after.
4. Resolution UI: quarantine list with filters (batch, reason), row raw view (masked by default, reveal audited), lead search **by KBS reference or bank reference only** (search by customer name is deliberately not offered here).

## Acceptance criteria
- [x] MIS-09: same reference on two leads → CONFLICT; row with no reference → UNMATCHED; customer name identical to a lead → still UNMATCHED.
- [x] Resolution creates a verified linkage and applies the row; audit row exists.

## Progress notes
- Pure matcher `matchRow(refs, linkages)` exported from `mis-pipeline.service.ts` (unit-testable): MATCHED / UNMATCHED / CONFLICT(REFERENCE_DISAGREEMENT); `match(batchId)` adds `DUPLICATE_IN_BATCH_DIVERGENT` for same reference on rows with different mapped values (identical duplicates already collapsed by F-502 rowHash). Explanations stored in `MisRow.matchExplanation`.
- `POST /mis/rows/:id/resolve` (MIS_RESOLVE, idempotent, audited) — `LINK_TO_LEAD` creates `BankApplicationLinkage(source MIS_RESOLVED_BY_ADMIN, VERIFIED_BY_MIS_MATCH)` and re-applies the row when the batch is already APPLIED; `IGNORE(reason)`; `PREFER_ROW`.
- Web: `rows.tsx` `Resolve` component on UNMATCHED/CONFLICT rows — lead lookup **by KBS reference only** (`/leads?q=`), prefer row, ignore with reason. MIS-09 covered in `mis-apply.e2e-spec.ts` (name-identical lead stays UNMATCHED).
- Deferred: dedicated cross-batch quarantine list with filters → F-507.
