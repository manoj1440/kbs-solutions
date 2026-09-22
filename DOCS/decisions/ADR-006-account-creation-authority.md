# ADR-006: Account creation authority and Admin bootstrap

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-03 §3.1 (OPEN), REQ-04, REQ-28 P2

## Decision
- The single Admin is created by `pnpm db:seed` from `BOOTSTRAP_ADMIN_MOBILE`/`BOOTSTRAP_ADMIN_NAME`. DB partial unique index prevents a second Admin.
- Admin creates Manager and Accounts users (name + mobile). Manager creates Telecallers (PRD MUST). Advisors self-register.
- Deactivation: Admin may deactivate anyone; Manager may deactivate own Telecallers. Reactivation of training-expired Telecallers is Manager-only (PRD MUST).
- All of the above are permissions in `@kbs/shared` `PERMISSIONS` map so KBS can change the matrix later without touching guards.

## Consequences
Fills the P2 OPEN item with the only reading consistent with "Admin sees everything"; recorded here so it is a conscious default, not an accident.
