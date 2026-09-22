# F-504 Deterministic MIS matching, quarantine and Admin resolution

- Group: MIS · Status: **PLANNED** · Depends on: F-502, F-407 · ADR-005, ADR-007
- PRD refs: REQ-13 §13.5 (bank + exact reference; preserve strings; no name/mobile/PAN/date/product/similarity matching; disagreeing/reused/missing/multi-lead → quarantine), §13.4 step 6 (row-level explanations; audited correction), §13.6 rows 6–7, INV-08, REQ-26 §26.4
- QA ids: MIS-09

## Detailed requirements
1. Matcher input per row: `(bankId, [(kind, value)…])`. Look up `BankApplicationLinkage` by exact `(bankId, kind, value)` for each reference in profile order. Outcomes: exactly one distinct lead across all references → `MATCHED`; none → `UNMATCHED`; two references pointing to different leads → `CONFLICT reason=REFERENCE_DISAGREEMENT`; same reference on ≥2 rows in the batch with different mapped values → all such rows `CONFLICT reason=DUPLICATE_IN_BATCH_DIVERGENT`; identical duplicate rows → keep one, others `DUPLICATE_IN_BATCH`.
2. `matchExplanation` text stored per row.
3. Resolution API (Admin, `MIS_RESOLVE`): `POST /mis/rows/:id/resolve {action: LINK_TO_LEAD(leadId, referenceKind) | IGNORE(reason) | PREFER_ROW(rowId) for divergent duplicates}` — linking creates `BankApplicationLinkage(source=MIS_RESOLVED_BY_ADMIN, verificationStatus=VERIFIED_BY_MIS_MATCH)` and re-queues apply for that row; every action audited with before/after.
4. Resolution UI: quarantine list with filters (batch, reason), row raw view (masked by default, reveal audited), lead search **by KBS reference or bank reference only** (search by customer name is deliberately not offered here).

## Acceptance criteria
- [ ] MIS-09: same reference on two leads → CONFLICT; row with no reference → UNMATCHED; customer name identical to a lead → still UNMATCHED.
- [ ] Resolution creates a verified linkage and applies the row; audit row exists.
