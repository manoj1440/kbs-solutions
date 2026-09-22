# F-204 Deadline expiry deactivation and Manager reactivation

- Group: Training · Status: **PLANNED** · Depends on: F-110, F-203
- PRD refs: REQ-05 §5.4 (auto-deactivate at 72 h; only assigned Manager reactivates; resume at first failed/unfinished module preserving passes; record original deadline, reactivation date, Manager, reason; new window OPEN), §5.5, REQ-15 §15.1, REQ-19 §19.1, REQ-23 §23.2
- QA ids: TRAIN-04, TRAIN-05, TRAIN-06

## Detailed requirements
1. Expiry (sweep job + lazy check): enrollment `IN_PROGRESS` with `deadlineAt < now` and not all passed → enrollment `EXPIRED_DEACTIVATED`, user `status=DEACTIVATED` with lifecycle event `DEACTIVATED reason=TRAINING_DEADLINE`, sessions revoked, notifications to Telecaller ("training deadline passed — contact your Manager") and Manager.
2. Reactivation `POST /telecallers/:id/training/reactivate {reason}` — only the **currently assigned** Manager (scope check). Effects: user `ACTIVE`, lifecycle `REACTIVATED`, `TrainingReactivation` row (`originalDeadlineAt`, `newDeadlineAt`, `resumedAtModuleSequence` = first module not `PASSED`), enrollment `REACTIVATED_IN_PROGRESS`, `currentModuleSequence` = resumed module; earlier `PASSED` results untouched.
3. New window: `training.reactivationWindowHours` — if **null (BLOCKED per PRD)**, reactivation still succeeds but `newDeadlineAt=null` and the training gate reports `reason=REACTIVATION_WINDOW_NOT_CONFIGURED`; the Telecaller sees an explicit message; Admin launch-gate checklist shows the key. Nothing silently grants unlimited time.
4. Manager screens: Telecaller detail shows deadline/expired state, "Reactivate" with reason dialog and the window that will apply; Admin sees the same read-only plus aggregate pass/fail counts.

## Acceptance criteria
- [ ] TRAIN-04: enrollment with M1, M2 passed at deadline → deactivated; `GET /calling/queue` → blocked; customer data endpoints refuse.
- [ ] TRAIN-05: reactivation → next screen is Module 3; M1/M2 remain PASSED; reactivation row recorded.
- [ ] TRAIN-06: Manager B reactivating Manager A's Telecaller → NOT_FOUND-shaped refusal + audit.
