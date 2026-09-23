# F-903 Database-level protection of bank-status tables

- Group: Hardening · Status: **IN_PROGRESS** · Depends on: F-505
- PRD refs: INV-01, REQ-13 §13.1, REQ-27 MIS-07

## Scope
Postgres trigger on `BankStatusSnapshot`/`BankStatusHistory` that rejects writes unless `SET LOCAL kbs.mis_apply = 'on'` is present in the transaction (set only by `withMisApplyContext`); separate DB role for API without direct UPDATE grants in prod.
