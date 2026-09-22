# F-103 Audit log, sensitive-access log, request ids, redacted logging

- Group: Core · Status: **PLANNED** · Depends on: F-003, F-005
- PRD refs: REQ-03 §3.3 (capture access/edit/export of sensitive records), REQ-24 §24.3 (actor/time/source trace for every listed action; no raw PII in logs), REQ-21 §21.1
- QA ids: AUDIT-01

## Detailed requirements
1. `RequestIdMiddleware`: accept `X-Request-Id` or generate UUIDv7; attach to logger child, response header, audit rows, job payloads.
2. `AuditInterceptor` on every non-GET route: writes `AuditLog {action = '<module>.<handler>', entityType/id from handler metadata or response, before/after when the service provides them, actor, ip, requestId}`. Services can enrich via `AuditContext.set({...})`.
3. `auditService.record()` for domain events in jobs (import applied, deadline expired, entitlement created).
4. `SensitiveAccessLog` written by: `?reveal=` paths, recording playback URL issuance, cheque/proof/ID-card downloads, MIS raw-row view, exports.
5. pino with `redact: ['req.headers.authorization','*.mobile','*.pan','*.aadhaar*','*.accountNumber','*.otp','*.code','*.token*']` and a serializer that masks E.164 patterns defensively.
6. Read API for Admin: `GET /audit?entityType&entityId&actor&action&from&to` (paginated) — feeds F-704.

## Acceptance criteria
- [ ] AUDIT-01: creating a user, uploading a file, allocating a record, reactivating training, recording a payment each produce an audit row with actor/time/requestId (e2e).
- [ ] Log capture test: a request body containing a mobile and PAN produces no plaintext of either in logs.
- [ ] Audit tables have no `UPDATE`/`DELETE` path in code (grep test) — append-only.
