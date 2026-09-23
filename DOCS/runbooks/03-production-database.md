# Production database hardening (F-903)

1. Run migrations as the owner role: `pnpm --filter @kbs/db migrate:deploy` (or `node packages/db/scripts/wasm-migrate.mjs apply` where the Prisma engine cannot be downloaded).
2. Create the application role once: `psql -U <owner> -d <db> -f docker/postgres/app-role.sql` (set the real password from the secret manager first and uncomment the `GRANT CONNECT` line with the database name).
3. Point the API's `DATABASE_URL` at `kbs_app`, never at the owner. Migrations keep using the owner URL.

What this guarantees (INV-01, REQ-13 §13.1, MIS-07):

- `BankStatusSnapshot` / `BankStatusHistory` rows can be inserted, updated or deleted only inside a transaction that ran `set_config('kbs.mis_apply', 'on', true)` — the `kbs_guard_bank_status()` trigger rejects everything else with `INV-01 … (kbs.mis_apply)`, including raw SQL. Only the MIS apply service does this (`MIS_APPLY_SET_LOCAL` / `misApplyTransaction` in `@kbs/db`), in addition to the Prisma-extension guard.
- `kbs_app` is not the table owner, so it cannot `DISABLE TRIGGER`, drop the guard or `TRUNCATE`. It cannot delete bank-status history, audit or sensitive-access logs, or payout entitlement events, and cannot update the append-only ledgers.
- Local/test databases use the owner role, so `resetDatabase` (TRUNCATE) keeps working; `TRUNCATE` does not fire row triggers.
