# API conventions

Base path `/api/v1`. JSON only. OpenAPI generated from Zod schemas at `/api/docs` (dev only).

## Envelope
```json
// success
{ "data": { ... }, "meta": { "requestId": "…", "asOf": "2026-09-22T10:00:00Z" } }
// list
{ "data": [ ... ], "meta": { "requestId": "…", "page": 1, "pageSize": 50, "total": 1234 } }
// error
{ "error": { "code": "TRAINING_GATE_BLOCKED", "message": "Complete Module 3 to access the calling queue.", "details": {…} }, "meta": { "requestId": "…" } }
```
Error codes are an enum in `@kbs/shared` (`ErrorCode`). Messages are role-appropriate and never reveal whether another user/customer exists (REQ-23 §23.1).

## Auth
- `POST /auth/otp/request { mobile, purpose }` → `{ challengeId, expiresInSec, resendAfterSec }`
- `POST /auth/otp/verify { challengeId, code, platform, deviceId? }` → `{ accessToken, refreshToken, user, gates }` (mobile) or sets cookies (web when `platform=WEB`).
- `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` → user + `gates` object:
  ```json
  { "training": {"required":true,"passed":false,"deadlineAt":"…","currentModule":2},
    "network": {"required":true,"allowed":false,"reason":"OUTSIDE_OFFICE_NETWORK"},
    "onboarding": {"required":true,"complete":false,"step":"BANK_DETAILS"} }
  ```
  Clients route on `gates`; the server enforces the same gates on every protected endpoint.
- `GET /auth/me` also returns `account: { lastLoginAt, supportContact, accessExpiresInSec }` (F-804, optional in the contract).
- Web session lifecycle (F-804): the refresh cookie is `Path=/api/v1/auth` on the API, so web pages never see it. A protected web page without the access cookie goes to `/session?next=…`; that browser page calls `POST /auth/refresh` with credentials (cookie-only, no tokens in the body) and returns, or sends the user to `/login?reason=session-expired|deactivated|required&next=…`. Open web shells refresh two minutes before `accessExpiresInSec`. `POST /auth/logout-all` ends every session of the account.
- `GET /notifications/:id/target` → `{ entityType, entityId, targetRole }` after a scope re-check; `targetRole` is set for `User` targets so the web opens the Telecaller or Advisor page.

## Headers
`Authorization: Bearer <access>` (mobile) · cookie (web) · `Idempotency-Key: <uuid>` on POST/PUT that create side effects · `X-Request-Id` optional (echoed) · `X-Network-Ssid-Hint` optional (Telecaller mobile).

## Provenance on every status-bearing DTO
```ts
{ value: 'Decisioned Cases' | null, raw: '<exact cell text>' | null,
  provenance: 'BANK_MIS', asOf: '<lastMatchedAt>' , batchRef: 'KBS-B-…' | null,
  display: 'Decisioned Cases' | 'Not reported' | 'Awaiting MIS Update' }
```
`display` is computed server-side by one function in `@kbs/shared` so web and mobile never disagree (REQ-13 §13.6).

## Masking
Default responses mask `mobile` (`+91••••••1234`), `pan` (`•••••1234F`), bank account (last 4). A `?reveal=pan` query needs the `SENSITIVE_REVEAL` permission for that entity and writes `SensitiveAccessLog`. Payee bank for payment: `GET /payouts/requests/:id/payee?reveal=bank` (Accounts/Admin, dual-approved requests only; logged as `BANK_ACCOUNT` / `PAYOUT_PAYMENT`). Bank transfer references are masked to the last 4 in the Advisor receipt (`maskTransferReference`).

## Pagination & filtering
`?page=&pageSize=(≤200)&sort=field:asc|desc&filter[field]=value`. Filters are whitelisted per endpoint via Zod.

## Role scoping
Every list/get service takes `Actor` (`userId, role, teamUserIds[]`) and applies a scope `where` builder. Controllers never query Prisma directly.

## Long-running operations (F-508, ADR-013)
`POST /mis/batches/:id/preview` and `/apply` return the result directly for batches up to `mis.asyncRowThreshold` rows. Above it they return `201 { queued: true, alreadyRunning, batchId, stage, job }` and run in the background; poll `GET /mis/batches/:id/job` (`job.status` QUEUED → RUNNING → SUCCEEDED | FAILED, `job.progress {phase, done, total}`). Triggering again while a job is active returns the same job with `alreadyRunning: true`.

F-809: `GET /mis/applications` + `/mis/applications/summary` list the cumulative bank-reported state per application (`BankStatusSnapshot` + lead, mobiles masked) with `bankId/q/stage/decision/activation` filters; `POST /mis/batches` accepts `profileId` optional — omitted resolves to the bank's latest APPROVED profile (the shared MIS layout).

F-810: `GET /leads/summary` returns scope-aware cumulative buckets (`total/matched/awaitingMis/approved/declined/inProcess/cardsActive/cardsInactive/decisionBlank/activationBlank`) for the same actor scope as `GET /leads` — powers the compact leads tiles without an extra list fetch.
