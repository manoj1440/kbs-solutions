# F-903 Database-level protection of bank-status tables

- Group: Hardening · Status: **DONE** · Depends on: F-505
- PRD refs: INV-01, REQ-13 §13.1, REQ-27 MIS-07

## Scope
Postgres trigger on `BankStatusSnapshot`/`BankStatusHistory` that rejects writes unless `SET LOCAL kbs.mis_apply = 'on'` is present in the transaction (set only by `withMisApplyContext`); separate DB role for API without direct UPDATE grants in prod.

## Progress notes
- Migration `20260923140000_bank_status_db_guard`: `kbs_guard_bank_status()` BEFORE INSERT/UPDATE/DELETE row triggers on both tables; error `INV-01: <op> on "<table>" is only allowed inside the MIS apply transaction (kbs.mis_apply)` (SQLSTATE insufficient_privilege).
- The MIS pipeline runs `SELECT set_config('kbs.mis_apply','on',true)` (`MIS_APPLY_SET_LOCAL`) as the first statement of every bank-status write transaction (per-row apply and FULL_SNAPSHOT absence rows). `misApplyTransaction(client, batchId, fn)` wraps context + transaction + flag for any future caller. The flag is transaction-local (test asserts it does not leak).
- Production role: `docker/postgres/app-role.sql` + `DOCS/runbooks/03-production-database.md` — API connects as non-owner `kbs_app` (cannot disable triggers / truncate; append-only ledgers). Verified: `kbs_app` gets "must be owner" on DISABLE TRIGGER and "permission denied" on DELETE FROM "AuditLog".
- Tests: `packages/db/test/invariants.test.ts` (raw INSERT refused, app context alone refused, `misApplyTransaction` reaches FK, flag not leaking), `apps/api/test/mis-apply.e2e-spec.ts` MIS-07 raw UPDATE/DELETE refused and value unchanged.
- Tooling: the offline migration runner now sends each migration as one query, so `$$` function bodies work.
