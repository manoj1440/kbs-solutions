# F-105 User administration and lifecycle

- Group: Core · Status: **PLANNED** · Depends on: F-101, F-102, F-103
- PRD refs: REQ-03 §3.1 (account origins), REQ-04 §4.3 (lifecycle events with who/when/why; preserve history), REQ-16 §16.1, REQ-25 §25.4, ADR-006, gap analysis A1
- QA ids: AUDIT-01 (user changes)

## Detailed requirements
1. Admin creates Manager and Accounts users with name + mobile (+ optional e-mail). Managers create Telecallers (F-201). Advisors self-register (F-401). No other creation paths.
2. Lifecycle: `ACTIVE ⇄ DEACTIVATED`, `BLOCKED` (security), with `UserLifecycleEvent` (actor, reason mandatory). Deactivation revokes sessions immediately, keeps assignments, training, activity, payouts and MIS history intact (nothing is deleted).
3. Admin can deactivate any non-Admin user; Manager can deactivate own Telecallers; reactivation of a *training-expired* Telecaller is only via F-204 (Manager). Reactivation of an Admin-deactivated user is Admin-only.
4. Admin-only session revocation (`POST /users/:id/sessions/revoke`).
5. `auth.recoveryEnabled=false` by default; when true, Admin may change a user's mobile with reason (recorded as lifecycle event `MOBILE_CHANGED`) — policy OPEN per PRD, so the flag exists but is off.
6. Lists: Admin sees all users with role/status/parent/last login; Manager sees own team.
7. Web screens: Users table (filters role/status/search by name or masked mobile), Create user dialog, User detail with lifecycle timeline, sessions, reporting parent.

## Acceptance criteria
- [ ] A second `ADMIN` cannot be created via API (400) or DB (unique violation).
- [ ] Deactivating a Telecaller with assigned customers keeps assignments visible to the Manager with the user flagged inactive.
- [ ] Every lifecycle transition has an audit row + lifecycle event with reason.
