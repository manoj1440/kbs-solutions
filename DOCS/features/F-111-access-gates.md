# F-111 Access gates (training / network / onboarding) in `/auth/me` and guards

- Group: Core · Status: **DONE** · Depends on: F-101, F-102, F-104
- PRD refs: REQ-04 §4.1 (login validates role, activation, training gate, network restrictions, onboarding, session policy before home), §4.2, REQ-05 §5.2 (queue blocked until modules pass), REQ-09 §9.1–9.2 (Telecaller only), REQ-23 §23.1
- QA ids: TRAIN-03, SEC-01 (server side), AUTH-01

## Detailed requirements
1. `GatesService.compute(actor, requestContext)` returns:
   ```
   training:   { required: role===TELECALLER, passed, deadlineAt, currentModuleSequence, status }
   network:    { required: role===TELECALLER && network.enforceForTelecallers, allowed, reason?: OUTSIDE_OFFICE_NETWORK|ALLOWLIST_EMPTY|WFH_ACTIVE|OFFICE_MATCH }
   onboarding: { required: role===ADVISOR, complete, step }
   account:    { active: status===ACTIVE || PENDING_ONBOARDING, reason? }
   ```
   Computed from persisted state at request time (never from job side-effects alone — ADR-004).
2. `PolicyGuard` applied via decorators: `@RequiresTrainingPassed()`, `@RequiresOfficeNetwork()`, `@RequiresOnboardingComplete()`. Controllers for the calling queue, customer details and call initiation carry both training and network; Advisor lead/catalogue/payout routes carry onboarding only (never network — INV-09).
3. Error codes `GATE_TRAINING_BLOCKED`, `GATE_NETWORK_BLOCKED`, `GATE_ONBOARDING_INCOMPLETE`, `AUTH_ACCOUNT_DEACTIVATED` with role-appropriate messages and a `recovery` hint (`CONTACT_MANAGER`, `COMPLETE_TRAINING`, `USE_OFFICE_WIFI`, `CONTINUE_ONBOARDING`).
4. Clients route purely on `gates` from `/auth/me`; mobile re-fetches on foreground.

## Acceptance criteria
- [x] TRAIN-03: Telecaller with Module 3 unpassed gets `GATE_TRAINING_BLOCKED` on `GET /calling/queue`.
- [x] SEC-01: Telecaller from a non-allowlisted IP without WFH gets `GATE_NETWORK_BLOCKED`; Advisor from any IP is never network-gated.
- [x] Deadline passed but sweep job not yet run → still blocked (lazy evaluation test).

## Progress notes
- 2026-09-22 (session 1): GatesService (lazy evaluation), PolicyGuard with @RequireGates, error codes + recovery hints, `/auth/me` gates; e2e covers deadline-passed lazy block and network gates; mobile routes on gates.
