# F-507 MIS integrity and freshness dashboard, unmatched cases

- Group: MIS · Status: **PLANNED** · Depends on: F-505, F-504
- PRD refs: REQ-16 §16.2 (MIS integrity and freshness tile set), §16.1 (unmatched MIS cases, upload logs), REQ-13 §13.8 (freshness = per lead, not global), REQ-19 §19.1 (Admin import notifications)

## Detailed requirements
1. `GET /dashboards/mis-integrity?bankId&from&to` → per bank: last upload, last applied, rows imported/matched/unmatched/invalid/conflicted, new values pending mapping, duplicate keys, corrections requiring review (entitlements UNDER_REVIEW), leads never matched (count + list link), Advisor-entered references never matched.
2. Web page with tiles, per-bank table, drill-downs to batches, quarantine (F-504), pending new values (approve into `knownValues`).

## Acceptance criteria
- [ ] Figures reconcile with batch totals in a fixture.
