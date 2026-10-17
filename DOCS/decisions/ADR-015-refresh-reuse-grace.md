# ADR-015: Refresh-token rotation — atomic claim and a short benign-retry window

- Status: Accepted
- Date: 2026-10-17
- PRD refs: REQ-04 §4.3 (sessions), REQ-21 §21.5 (reuse detection revokes the session), REQ-25 §25.1 (web session continuity)

## Context
Refresh tokens rotate on every use and a used token presented again revokes the whole session (F-101). On the web two
legitimate patterns break that rule:

1. **Aborted response.** A page's background request gets 401, the client starts `POST /auth/refresh`, and the user
   navigates. The server has already rotated (old token used, successor issued) but the response with the successor's
   cookie never reaches the browser. The next refresh presents the old token → "reuse" → session revoked → the user
   lands on `/login?reason=session-expired` although nothing was stolen. Reproduced 5 of 6 runs of the web e2e
   "lapsed access cookie" test against a production build (F-808 notes called it the refresh race).
2. **Concurrent refreshes.** Several 401s in one page (or two tabs) refresh at once with the same cookie. Rotation
   was check-then-write, so both could pass (an accidental fork) or the later one hit reuse detection.

## Decision
- **Atomic claim.** `refresh()` marks the presented token used with `UPDATE … WHERE id = ? AND usedAt IS NULL`; only
  the request that wins the claim rotates normally.
- **Benign-retry window (30 s).** A token that is already used is still accepted — once per request, returning a new
  sibling token in the same family — only when **all** hold: it was used less than 30 s ago, its successor has never
  been used, and the session is not revoked. Anything else is reuse as before: the session is revoked and
  `auth.refresh.reuse` is audited. A grace refresh is audited as `auth.refresh.grace`.
- **Client single-flight.** The browser API client shares one in-flight refresh among concurrent 401s on a page.
- The window is a constant (`REFRESH_REUSE_GRACE_MS`), not a SystemConfig key: it is a protocol tolerance, not a KBS
  business policy. Upgrade path: move it to `auth.refreshReuseGraceSec` if KBS security asks to tune it.

## Consequences
- A stolen token replayed within 30 s of the legitimate rotation, before the legitimate client uses its successor,
  yields a valid sibling instead of revoking the session. Detection still triggers on any replay after 30 s or after
  the legitimate client has refreshed again, and every grace use is audited with the session id.
- One-time-use is still enforced per token; a family can briefly have two live siblings (both expire normally and each
  is single-use).
- Mobile (bearer refresh in the body) gets the same tolerance for retried requests on flaky networks.

## Alternatives considered
- **Return the successor again** for a retried token: impossible — only token hashes are stored.
- **Client-only fix** (single-flight, `keepalive` fetch): cannot help when the response is lost to navigation or the
  network; the server must tolerate the retry.
- **Longer access tokens** to refresh less often: reduces frequency, not the failure.
