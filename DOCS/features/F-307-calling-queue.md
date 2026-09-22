# F-307 Telecaller calling queue, follow-ups, hidden history

- Group: Telecaller ops · Status: **DONE** · Depends on: F-111, F-305, F-306, F-802
- PRD refs: REQ-06 §6.1 (row fields), §6.5 (active vs hidden; follow-up visible with due date/note; authorised retrieval of hidden and full history), REQ-25 §25.2 (My Calling Queue, Follow-ups, History/Hidden), REQ-08 §8.3 (masked mobile as role permits)
- QA ids: RBAC-01, CUST-04

## Detailed requirements
1. `GET /calling/queue?tab=active|followups|hidden&search&sort` — Telecaller only (own), gated by training + network. Active = `hiddenAt IS NULL AND suppressed=false AND (interactionStatus IN (UNTOUCHED, FOLLOW_UP, INTERESTED, LINK_SHARED, UNREACHABLE))`; follow-ups = `nextFollowUpAt IS NOT NULL` ordered by due; hidden = `hiddenAt IS NOT NULL` (read-only).
2. Row DTO: name, masked mobile (full mobile revealed only at call time by the telephony flow — never listed), pincode, resolved location or "Location unavailable", assigned Telecaller, interaction status, next follow-up, last outcome summary, `Call` availability (false if suppressed).
3. `GET /calling/records/:id` (own) → full detail: history of attempts/outcomes/shares/remarks, sourceable cards (F-308).
4. Manager/Admin read endpoints with scope (`/calling/records?telecallerId=`), including hidden rows and full history.
5. Mobile screens: queue tabs with search and due badges; follow-up list; history list; pull-to-refresh; offline empty/error states.

## Acceptance criteria
- [x] RBAC-01: Telecaller sees own rows only; Manager team; Admin all.
- [x] CUST-04: follow-up remains in active/follow-ups; declined/completed hidden but retrievable in history with full trail.

## Progress notes
- 2026-09-22 (session 2): `GET /calling/queue?tab=active|followups|hidden&search&page` (Telecaller own; `@RequireGates('training','network')`; `meta.counts {active, followups, dueNow, hidden}`), `GET /calling/records?telecallerId&tab` (Manager team / Admin all; Manager asking for a non-team Telecaller → 403), `GET /calling/records/:id` (scoped; out-of-scope → 404 so existence never leaks; full trail: outcomes, call attempts, interests, shares, allocation events, operational remarks). Mobiles always masked in lists/details; `canCall=false` when suppressed/hidden. Mobile: `(telecaller)/index.tsx` tabs Queue / Follow-ups (due-now badge) / History with search + pull-to-refresh, `(telecaller)/record.tsx` detail with history (Call button disabled until F-309). Web Manager/Admin read views share `CallingDistribution`. Auth hardening found by tests: the 72h training window now starts only for `NOT_STARTED` enrollments (a PASSED Telecaller logging in for the first time is not reset).
