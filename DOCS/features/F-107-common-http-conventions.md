# F-107 Common HTTP conventions: envelope, errors, pagination, idempotency

- Group: Core · Status: **PLANNED** · Depends on: F-003, F-004
- PRD refs: REQ-24 §24.1 (retry without duplicate side effects), REQ-08 §8.2 (double-tap), REQ-17 §17.3 (double-tap / simultaneous requests), REQ-23 §23.1 (messages that do not reveal other accounts), `DOCS/architecture/04-api-conventions.md`

## Detailed requirements
1. `ResponseEnvelopeInterceptor` wraps `{data, meta{requestId, asOf}}`; list results `{data[], meta{page,pageSize,total}}`.
2. `AppError` + `AppExceptionFilter` mapping `ErrorCode` → HTTP status; Zod errors → `VALIDATION_FAILED` with field paths; unknown errors → 500 with requestId only.
3. `Pagination` Zod query (`page≥1`, `pageSize≤200`), `sort` whitelist per endpoint, `filter[...]` whitelist via per-endpoint schema.
4. `IdempotencyInterceptor`: for routes decorated `@Idempotent()`, require `Idempotency-Key` (uuid); store `(userId,key,route)` → response for 24 h in Postgres (`IdempotencyRecord`) with a Redis lock during execution; replay returns the stored response with `meta.idempotentReplay=true`; concurrent same-key requests wait on the lock then replay.
5. `ThrottlerGuard` global (per IP) with stricter per-route limits on OTP.
6. Health/readiness endpoints.

## Acceptance criteria
- [ ] Two concurrent POSTs with the same key produce one side effect and identical responses.
- [ ] Missing key on an `@Idempotent` route → `VALIDATION_FAILED` with a clear message.
- [ ] Error bodies never include stack traces or internal ids in production mode.
