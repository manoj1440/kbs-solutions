# F-106 Reporting hierarchy and Agent Codes

- Group: Core · Status: **PLANNED** · Depends on: F-105
- PRD refs: REQ-03 §3.2, REQ-10 §10.4 (code during signup or later; valid code → mapped person; blank → Admin; unknown/revoked → clear message, pending/none), REQ-15 §15.1 (no cross-team reassignment without logged authorisation), REQ-28 P1 (attribution policy), gap analysis B7
- QA ids: FOS-02, TRAIN-06 (team boundary)

## Detailed requirements
1. `ReportingAssignment` effective-dated; exactly one open row per child. Sources: `MANAGER_CREATED_TELECALLER` (auto at F-201), `AGENT_CODE`, `ADMIN_DEFAULT` (Advisor with blank code), `ADMIN_REASSIGNED`.
2. `AgentCode`: Admin creates codes for a Manager (or for Admin itself); format from config; `REVOKED` codes cannot be used; optional expiry. **OPEN in PRD whether a code can point to non-Manager/Admin — we restrict to Manager/Admin.**
3. Applying a code: validate → if valid, close current assignment (`effectiveTo=now`) and open a new one; if `hierarchy.agentCodeChangeRequiresAdminApproval` and the Advisor already has any lead, create a `PENDING_APPROVAL` assignment that Admin approves/rejects; the Advisor sees "pending". Unknown/revoked → `HIERARCHY_CODE_INVALID`, nothing changes.
4. Attribution: leads snapshot `reportingParentUserIdSnapshot` at creation; entitlements snapshot at eligibility (F-602). Historical attribution never changes when the code changes (REQ-03 §3.2 requires auditability, not retro-change).
5. Admin reassign Telecaller to another Manager: `ADMIN_REASSIGNED` with reason; calling assignments stay with the Telecaller.
6. Endpoints: `GET/POST /agent-codes`, `POST /agent-codes/:id/revoke`, `POST /me/agent-code` (Advisor), `POST /users/:id/reporting` (Admin), `GET /users/:id/reporting-history`.

## Acceptance criteria
- [ ] FOS-02: valid code → parent = code owner; blank → Admin; later code change with existing leads → pending until Admin approves; historical leads keep old snapshot.
- [ ] Manager A cannot see or act on Manager B's Telecaller (scope test reused by TRAIN-06).
