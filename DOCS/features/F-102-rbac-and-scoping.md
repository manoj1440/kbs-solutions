# F-102 RBAC, permissions matrix and data scoping

- Group: Core · Status: **PLANNED** · Depends on: F-101
- PRD refs: REQ-03 §3.1–3.3 (roles, hierarchy, server-side enforcement), REQ-15 §15.1 (Manager own team), REQ-18 §18.2 (Accounts limits), ADR-006
- QA ids: RBAC-01, RBAC-02

## Detailed requirements
1. `Actor` object built per request: `{userId, role, status, teamUserIds (for Manager: all Telecallers + Advisors currently reporting to them), reportingParentUserId}`.
2. `@RequirePermission(Permission.X)` decorator + `RolesGuard` using `ROLE_PERMISSIONS` from `@kbs/shared`. Permissions are fine-grained (e.g. `TELECALLER_CREATE`, `TELECALLER_REACTIVATE`, `WFH_GRANT`, `CUSTOMER_LIST_IMPORT`, `MIS_IMPORT`, `MIS_RESOLVE`, `CATALOGUE_MANAGE`, `PAYOUT_REQUEST`, `PAYOUT_APPROVE_MANAGER`, `PAYOUT_APPROVE_ADMIN`, `PAYMENT_RECORD`, `SENSITIVE_REVEAL_PAN`, `SENSITIVE_REVEAL_BANK`, `RECORDING_PLAY`, `CONFIG_MANAGE`, `USER_MANAGE`, …).
3. Scope builders in `common/scope/`: `scopeCallingRecords(actor)`, `scopeLeads(actor)`, `scopeUsers(actor)`, `scopePayoutRequests(actor)`, `scopeRecordings(actor)` returning Prisma `where` fragments: Telecaller → own assignments; Advisor → own leads/entitlements/profile; Manager → team; Admin → all; Accounts → only requests in `APPROVED | PAYMENT_RECORDED_PENDING_PROOF | PAID | ON_HOLD` and payee summary fields.
4. Object-level check helper `assertCanAccess(actor, entity)` used by every `GET /:id` and file download.
5. Accounts has no permission that touches MIS, hierarchy, catalogue, activation or approvals (REQ-18 §18.2).
6. Admin's sensitive reads are permitted but always logged (F-103).

## Acceptance criteria
- [ ] RBAC-01: fixture with 2 Managers, 2 Telecallers each, 2 Advisors each, Accounts; list endpoints return exactly the scoped rows per actor.
- [ ] RBAC-02: direct `GET` of another user's lead/PAN reveal/recording/cheque/proof returns 404-shaped `NOT_FOUND` (not 403, to avoid existence leaks) and is audited.
- [ ] Matrix test: every controller route declares a permission (reflection test fails on an undecorated protected route).
