# F-704 Data and permissions audit dashboard

- Group: Dashboards & notifications · Status: **IN_PROGRESS** · Depends on: F-103, F-104
- PRD refs: REQ-16 §16.2 (user management, training/WFH, sensitive access, catalogue/link versions, MIS corrections, payout changes), REQ-24 §24.3

## Detailed requirements
Web page over `GET /audit` and `GET /sensitive-access` with filters (actor, action, entity, date), export disabled by default (`audit.exportEnabled=false`, OPEN policy), detail drawer with before/after diff.

## Acceptance criteria
- [ ] Every action listed in REQ-24 §24.3 is filterable by its action key.
