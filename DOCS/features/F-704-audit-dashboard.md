# F-704 Data and permissions audit dashboard

- Group: Dashboards & notifications · Status: **DONE** · Depends on: F-103, F-104
- PRD refs: REQ-16 §16.2 (user management, training/WFH, sensitive access, catalogue/link versions, MIS corrections, payout changes), REQ-24 §24.3

## Detailed requirements
Web page over `GET /audit` and `GET /sensitive-access` with filters (actor, action, entity, date), export disabled by default (`audit.exportEnabled=false`, OPEN policy), detail drawer with before/after diff.

## Acceptance criteria
- [x] Every action listed in REQ-24 §24.3 is filterable by its action key.

## Progress notes
- `@kbs/shared` `AUDIT_ACTION_GROUPS`: REQ-24 §24.3 / REQ-16 §16.2 categories (uploads, mapping revisions, lead reference linkage, bank status changes, assignment & WFH, training expiry/reactivation, payout rules & decisions, manual payments, user management, catalogue & link versions, configuration). A test scans `apps/api/src` and fails if any catalogued key is not written by an `@Audited` route.
- API: `GET /audit?group&action (exact, or prefix ending with '.')&actorUserId&entityType&entityId&from&to` (IST days, actor name/role included, `meta.exportEnabled`), `GET /audit/actions` (catalogue with counts + other keys + entity types), `GET /audit/:id` (field-level before/after diff), `GET /audit/sensitive-access` (with actor), `GET /audit/export` (CSV; 403 unless `audit.exportEnabled`; the export is itself audited as `audit.export`). `StreamableFile` responses now bypass the JSON envelope.
- Fixes found while testing: the audit interceptor did not await its write (reads right after a response could miss the row → the intermittent audit-count failures in catalogue/training tests); `config.update` wrote two audit rows (service + interceptor) — now one row with `{value}` before/after.
- Web `/admin/audit`: Actions / Sensitive access tabs, filters, per-row before/after diff, pagination, export button only when enabled. Browser-checked.
