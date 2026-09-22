# F-204 Deadline expiry deactivation and Manager reactivation

- Group: Training · Status: **DONE** · Depends on: F-110, F-203
- PRD refs: REQ-05 §5.4 (auto-deactivate at 72 h; only assigned Manager reactivates; resume at first failed/unfinished module preserving passes; record original deadline, reactivation date, Manager, reason; new window OPEN), §5.5, REQ-15 §15.1, REQ-19 §19.1, REQ-23 §23.2
- QA ids: TRAIN-04, TRAIN-05, TRAIN-06

## Detailed requirements
1. Expiry (sweep job + lazy check): enrollment `IN_PROGRESS` with `deadlineAt < now` and not all passed → enrollment `EXPIRED_DEACTIVATED`, user `status=DEACTIVATED` with lifecycle event `DEACTIVATED reason=TRAINING_DEADLINE`, sessions revoked, notifications to Telecaller ("training deadline passed — contact your Manager") and Manager.
2. Reactivation `POST /telecallers/:id/training/reactivate {reason}` — only the **currently assigned** Manager (scope check). Effects: user `ACTIVE`, lifecycle `REACTIVATED`, `TrainingReactivation` row (`originalDeadlineAt`, `newDeadlineAt`, `resumedAtModuleSequence` = first module not `PASSED`), enrollment `REACTIVATED_IN_PROGRESS`, `currentModuleSequence` = resumed module; earlier `PASSED` results untouched.
3. New window: `training.reactivationWindowHours` — if **null (BLOCKED per PRD)**, reactivation still succeeds but `newDeadlineAt=null` and the training gate reports `reason=REACTIVATION_WINDOW_NOT_CONFIGURED`; the Telecaller sees an explicit message; Admin launch-gate checklist shows the key. Nothing silently grants unlimited time.
4. Manager screens: Telecaller detail shows deadline/expired state, "Reactivate" with reason dialog and the window that will apply; Admin sees the same read-only plus aggregate pass/fail counts.

## Acceptance criteria
- [x] TRAIN-04: enrollment with M1, M2 passed at deadline → deactivated; `GET /calling/queue` → blocked; customer data endpoints refuse.
- [x] TRAIN-05: reactivation → next screen is Module 3; M1/M2 remain PASSED; reactivation row recorded.
- [x] TRAIN-06: Manager B reactivating Manager A's Telecaller → NOT_FOUND-shaped refusal + audit.

## Progress notes
- 2026-09-22 (session 2): Sweep (`POST /training/sweep` + repeatable BullMQ job every 5 min in worker/inline mode) deactivates expired enrollments (lifecycle event, sessions revoked, notifications to Telecaller + Manager), idempotent. `POST /telecallers/:id/training/reactivate` (assigned Manager only; resume at first unpassed module; new window from `training.reactivationWindowHours`, null keeps the gate closed with reason `REACTIVATION_WINDOW_NOT_CONFIGURED`). Web Manager detail page with reactivation (browser-verified) and mobile detail screen. e2e `training-expiry.e2e-spec.ts` covers TRAIN-04/05/06.
