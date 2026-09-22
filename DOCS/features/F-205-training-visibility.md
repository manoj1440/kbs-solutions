# F-205 Training progress visibility for Manager and Admin

- Group: Training · Status: **DONE** · Depends on: F-203, F-204
- PRD refs: REQ-05 §5.5 (progress and aggregate pass/fail visible to assigned Manager and Admin), REQ-15 §15.1, REQ-16 §16.2 (Manager performance: team staffing/training)

## Detailed requirements
1. `GET /training/team` (Manager: own team; Admin: all, filter by Manager) → per Telecaller: status, first login, deadline, remaining time, per-module status/best score/attempts, reactivations.
2. Aggregates: counts by enrollment status, pass rate per module, average attempts — with population and date range in the response `meta`.
3. Web + mobile Manager view: table/cards with countdown chips; drill-down to attempts list (scores, timestamps; never the answers of live question versions).

## Acceptance criteria
- [x] Manager sees only own team's progress; Admin sees all and can filter.
- [x] Aggregates reconcile with row-level data in a test fixture.

## Progress notes
- 2026-09-22 (session 2): `GET /training/team` (Manager own team; Admin all or `?managerId=`) with `meta.byStatus`/`passRate`; `GET /telecallers/:id/training` detail incl. attempts and reactivations. Web: Manager team table, Admin `/admin/training/team` + detail; mobile Manager detail. Covered by the F-204 e2e.
