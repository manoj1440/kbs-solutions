# F-301 Office-network policy, WFH exceptions and network gate

- Group: Telecaller ops · Status: **IN_PROGRESS** · Depends on: F-104, F-111
- PRD refs: REQ-09 §9.1 (server-side checks not relying on SSID; Admin allowlist; Manager WFH grant/remove; record actor/scope/start/end/revocation/outcome), §9.2 (never Advisors), REQ-15 §15.1, REQ-16 §16.2, REQ-19 §19.1, REQ-28 P1 (egress IPs OPEN), gap analysis B8
- QA ids: SEC-01

## Detailed requirements
1. `OfficeNetwork` CIDR allowlist (Admin CRUD with reason; supports IPv4/IPv6 CIDRs; label). `network.allowEmptyAllowlist=false` ⇒ with no active networks and no exception, Telecallers are blocked (fail closed) and the Admin launch-gate shows "office networks not configured".
2. Request IP resolved from `X-Forwarded-For` only when `TRUST_PROXY` hops configured; otherwise socket address.
3. `WfhException`: Manager grants for own Telecaller with `startsAt`, optional `endsAt`, reason; revoke with reason. Admin can grant/revoke for anyone. Overlapping active exceptions disallowed.
4. Gate evaluation order: exception active → `ALLOWED_WFH`; else IP in allowlist → `ALLOWED_OFFICE`; else `DENIED`. Every evaluation on a gated route writes `NetworkAccessEvent` (sampled to one row per user per 5 min for allowed; every denial recorded).
5. Mobile sends `X-Network-Ssid-Hint` (best effort; hint only; stored, never trusted).
6. Screens: Admin → Network policy (allowlist table, add CIDR dialog), Exceptions overview; Manager → Telecaller detail → WFH toggle with dates/reason; Telecaller → blocked screen with reason and "contact your Manager".

## Acceptance criteria
- [ ] SEC-01: denied outside allowlist without exception; allowed with active exception; Advisor never evaluated.
- [ ] Revoking an exception blocks the next request immediately (no cache longer than 5 s).
- [ ] Access events show actor/IP/outcome; denials always recorded.

## Progress notes
- 2026-09-22 (session 1): API complete: CIDR allowlist CRUD, WFH grant/revoke (team-scoped), evaluation order, access events (denials always), SSID hint header; e2e SEC-01. Pending: Admin/Manager screens.
