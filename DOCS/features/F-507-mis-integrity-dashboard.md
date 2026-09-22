# F-507 MIS integrity and freshness dashboard, unmatched cases

- Group: MIS · Status: **DONE** · Depends on: F-505, F-504
- PRD refs: REQ-16 §16.2 (MIS integrity and freshness tile set), §16.1 (unmatched MIS cases, upload logs), REQ-13 §13.8 (freshness = per lead, not global), REQ-19 §19.1 (Admin import notifications)

## Detailed requirements
1. `GET /dashboards/mis-integrity?bankId&from&to` → per bank: last upload, last applied, rows imported/matched/unmatched/invalid/conflicted, new values pending mapping, duplicate keys, corrections requiring review (entitlements UNDER_REVIEW), leads never matched (count + list link), Advisor-entered references never matched.
2. Web page with tiles, per-bank table, drill-downs to batches, quarantine (F-504), pending new values (approve into `knownValues`).

## Acceptance criteria
- [x] Figures reconcile with batch totals in a fixture.

## Progress notes
- `MisIntegrityService` (mis module): `GET /dashboards/mis-integrity?bankId&from&to` (DASHBOARD_ADMIN) → per bank: last upload / last applied, batch stage counts, row states (imported/matched/unmatched/invalid/conflicted/duplicate/ignored/pending, from `MisRow.matchState`), `newValuesPending` (preview `newValues` minus the approved profile's `knownValues`), `duplicateKeys` (sum of preview duplicate references), `correctionsUnderReview` (`PayoutEntitlement.state = UNDER_REVIEW`), lead freshness (`neverMatched`, matched >7d / >30d — per lead), `advisorReferencesNeverMatched`, `quarantine`. `GET /dashboards/mis-integrity/quarantine?bankId&state&page` (MIS_RESOLVE) → masked UNMATCHED/CONFLICT rows across batches (the F-504 quarantine list).
- Web `/admin/mis/integrity`: tiles, per-bank table with drill-downs (batches, leads filtered by MIS freshness), "new values pending acknowledgement" (writes profile knownValues), cross-batch quarantine with the shared `Resolve` component (`components/mis-resolve.tsx`, extracted from the batch rows page). Nav "MIS integrity". Browser-checked (`scratchpad/mis-integrity.png`).
- Test: `mis-apply.e2e-spec.ts` reconciles dashboard rows with `MisRow` groupBy and per-batch `totals` (invalid, needsReview), lead/linkage counts, masked quarantine, and date-range behaviour.
