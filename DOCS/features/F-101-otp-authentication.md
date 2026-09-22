# F-101 OTP-only authentication and sessions

- Group: Core · Status: **PLANNED** · Depends on: F-003, F-004, F-005, F-109
- PRD refs: REQ-04 §4.1 (OTP-only; expiry, rate-limit, never plaintext), §4.2 (role-dependent first login), §4.3 (lifecycle), REQ-12 S06–S07, REQ-23 §23.1, REQ-21 §21.5, gap analysis A2, B9
- QA ids: AUTH-01, AUTH-02

## Detailed requirements
1. Every role logs in with registered mobile + OTP. There is **no** password or e-mail login anywhere (schema has no password column).
2. `POST /auth/otp/request {mobile, purpose: LOGIN|ADVISOR_SIGNUP}`: normalise to E.164; for `LOGIN` the mobile must belong to a user with status `ACTIVE` or `PENDING_ONBOARDING`; for `ADVISOR_SIGNUP` it must **not** belong to an existing user. **The response is identical in both cases** (`{challengeId, expiresInSec, resendAfterSec}`) so the endpoint never reveals whether a number exists (REQ-23 §23.1). If the number is unknown for LOGIN, a challenge is still created but flagged `phantom=true` and can never verify.
3. Code: 6 digits from CSPRNG; stored as SHA-256 hash with pepper; expires `auth.otp.expirySec` (default 300); resend cooldown `auth.otp.resendCooldownSec` (60); max sends per mobile per hour (10) and per IP per hour (30); max 5 wrong attempts per challenge then lock that mobile `auth.otp.lockMinutes` (15). All from `SystemConfig` (F-104).
4. `POST /auth/otp/verify {challengeId, code, platform, deviceId?, appVersion?}`: constant-time compare; on success consume challenge, create `Session` + `RefreshToken` (family), return `{accessToken (15 min JWT), refreshToken, user (masked), gates}`; for `platform=WEB` set httpOnly cookies instead of returning tokens. For ADVISOR_SIGNUP create user `role=ADVISOR,status=PENDING_ONBOARDING` (F-401 continues).
5. `POST /auth/refresh`: rotate; if a used token is presented again, revoke the whole family and return `AUTH_SESSION_REVOKED`.
6. `POST /auth/logout` (current session) and `POST /auth/logout-all`; Admin `POST /users/:id/sessions/revoke` (F-105).
7. `GET /auth/me` → user + `gates` (F-111). Login response must include gates so the client routes to training / onboarding / home (REQ-04 §4.2).
8. Web login only for roles in `SystemConfig.auth.webAccessRoles` (default ADMIN, MANAGER, ACCOUNTS); others get `AUTH_PLATFORM_NOT_ALLOWED` with the role-aware access error.
9. Telecaller sessions: single active session by default (`auth.telecallerSingleSession=true`) — a new login revokes the old session.
10. Lost/changed phone recovery is **OPEN** (REQ-04 §4.1): expose only an Admin-side `users/:id/change-mobile` behind a config flag `auth.recoveryEnabled=false` (F-105).

## Data
`OtpChallenge`, `Session`, `RefreshToken`, `UserLifecycleEvent(LOGIN?)` — no; logins are recorded in `AuditLog` (`auth.login`) and `User.lastLoginAt`.

## API
`/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/me`.

## Acceptance criteria
- [ ] AUTH-01: each seeded role can log in with mobile + OTP; no password route exists (route table test).
- [ ] AUTH-02: expired code, wrong code ×5 lock, resend cooldown, per-IP limit all return specific `ErrorCode`s without revealing account existence (request for unknown mobile returns same shape/timing class).
- [ ] Plain OTP never appears in DB or logs (test greps log output in console provider… the console provider prints `[dev-otp]` only when `NODE_ENV!==production`).
- [ ] Refresh reuse revokes family.
- [ ] Web verify sets cookies `HttpOnly; Secure (prod); SameSite=Lax`.

## Tests
`auth.service.spec.ts` (unit), `auth.e2e-spec.ts` (supertest with test DB).
