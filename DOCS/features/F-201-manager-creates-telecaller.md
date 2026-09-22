# F-201 Manager creates Telecaller (name + mobile) with employee code

- Group: Training · Status: **PLANNED** · Depends on: F-105, F-106
- PRD refs: REQ-05 §5.1, REQ-03 §3.2 (Telecaller assigned to creating Manager), REQ-08 §8.4 (ID card generated at creation), REQ-15 §15.1, REQ-26 §26.1 step 1
- QA ids: TRAIN-01

## Detailed requirements
1. `POST /telecallers {fullName, mobile}` — Manager only. Creates `User(role=TELECALLER, status=ACTIVE, employeeCode=KBS-TC-…, createdByUserId=manager)`, `ReportingAssignment(source=MANAGER_CREATED_TELECALLER)`, `TrainingEnrollment` placeholder (`firstLoginAt=null`), `OfficialIdCard` v1 (F-312 renders; here only the record with fields), lifecycle event `CREATED`, audit.
2. Mobile must be unique across users; duplicate → `CONFLICT` with a message that does not disclose the other user's role/name.
3. Admin cannot create Telecallers directly (PRD: Manager only) — permission matrix enforces; Admin may see all.
4. Manager screens (mobile + web): "Create Telecaller" form (name, mobile), success sheet showing employee code and "training starts at first login (72 h)".
5. Manager list: own Telecallers with training status, deadline countdown, active/deactivated.

## Acceptance criteria
- [ ] TRAIN-01: Manager creates; record shows assigned Manager and generated employee code; Admin sees it; another Manager does not.
- [ ] Admin `POST /telecallers` → `RBAC_FORBIDDEN`.
