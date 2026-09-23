# F-314 Telephony, WhatsApp delivery and recording oversight

- Group: Telecaller ops · Status: **DONE** · Depends on: F-309, F-310, F-311, F-313
- PRD refs: REQ-25 §25.4 ("telephony/WhatsApp delivery/recording oversight"), REQ-16 §16.1 (Admin oversees "operational call data/recordings"), REQ-08 §8.2 (failure visible, never "Recorded" without a retrievable recording, provider-confirmed vs user-selected), REQ-08 §8.5 (hand-off ≠ delivery), REQ-16 §16.3 (attempt / connected / share formulas), REQ-21 §21.1 (recording playback is a logged sensitive read), REQ-15 §15.3 (evidence, no scores)
- QA ids: CALL-02, WA-01, RBAC-01
- Origin: session 9 gap analysis — REQ-25 §25.4 screen inventory checked against the built routes. F-313 shows calls and shares **one Telecaller at a time**; nothing gave the Admin an organisation-wide view of provider health (failed calls, calls the provider never confirmed, failed / overdue recordings, WhatsApp delivery results). No feature file covered it.

## Detailed requirements
1. **Scope.** Admin sees the whole organisation; a Manager sees only calls/shares by users in their team (same rule as F-313); every other role → 403. Filters: date range (KBS `initiatedAt` for calls, `at` for shares — the date basis is returned), Telecaller/actor, Manager (Admin only; team resolved through the reporting hierarchy).
2. **Summary** `GET /calling/oversight/summary` — read-only counts with denominators and a `source` per block:
   - Calls (`TELEPHONY_PROVIDER`): total attempts initiated in KBS; provider-confirmed attempts (`providerCallId` set); failed before the provider accepted the call (FAILED with no `providerCallId`) — reported separately (REQ-16 §16.3); counts by provider state; connected = `connectedAt` set (never from outcomes); talk time; top failure reasons.
   - Recordings (`TELEPHONY_PROVIDER`), denominator = connected calls: available / pending / failed / none recorded yet; pending older than the overdue threshold is counted as overdue.
   - Shares (`KBS_SHARING`): by kind and channel; hand-off opened / failed; delivery counted only from provider statuses (SENT / DELIVERED / FAILED); hand-off shares are reported as "delivery not reported by provider", never as delivered (WA-01).
   - `attention` counts (see 3).
3. **Needs attention** (the operational worklist; all derived, nothing is written back):
   - `NO_PROVIDER_CONFIRMATION` — REQUESTED / RINGING / CONNECTED and initiated more than 30 minutes ago with no terminal provider event (same 30-minute live window `CallsService` uses to block re-dial).
   - `FAILED_BEFORE_PROVIDER` — FAILED and no `providerCallId`.
   - `RECORDING_FAILED` — recording row FAILED.
   - `RECORDING_OVERDUE` — connected call whose recording is PENDING (or missing) more than 60 minutes after the call ended.
   - `SHARE_FAILED` — hand-off FAILED or provider delivery FAILED.
   The 30 / 60-minute thresholds are display thresholds (engineering defaults, not business policy); they are returned in the response so the UI states them.
4. **Calls list** `GET /calling/oversight/calls` — paginated (`page`, `pageSize`), newest first; filters `state`, `recording`, `attention`, `telecallerId`, `managerId`, date range. Row: time, Telecaller (name, employee code), customer (name, masked mobile only), provider key + call id, provider state, connected/ended, duration, failure reason, recording chip (from `recordingChip`), recording failure reason, `canPlay` (AVAILABLE only), attention flags. Full mobile numbers never leave the API.
5. **Shares list** `GET /calling/oversight/shares` — paginated; filters `kind`, `channel`, `handoff`, `delivery`, `actorId`, `managerId`, date range. Row: time, actor (name, role), customer or lead reference, kind, card, asset version, masked target, channel, hand-off result, delivery status with a label that distinguishes "Hand-off only — delivery not reported" from provider statuses.
6. **Playback** reuses `GET /calls/:id/recording-url` (Manager team / Admin, logged as `SensitiveAccessLog` RECORDING/PLAYBACK). The oversight lists themselves do not expose recordings.
7. **Web (Admin)** `/admin/calling-list/oversight` ("Calls & delivery" in the Sales operations nav): date-range + filter form (GET params), summary tiles with denominators and source, attention chips that filter the calls/shares tables, calls table with recording chip and audited play button, shares table, pagination. Responsive: no page-level horizontal overflow at 390 px.
8. No new data is written; no provider state is ever inferred or changed from this screen (INV-01 spirit: provider-confirmed facts only come from provider events).

## Acceptance criteria
- [x] Admin summary separates provider-confirmed attempts from failures before the provider, and connected only from provider `connectedAt`.
- [x] Recording coverage uses connected calls as denominator; a FAILED recording is never counted or shown as available (CALL-02).
- [x] A hand-off share is never counted as delivered; provider FAILED delivery appears in attention (WA-01).
- [x] Stale un-confirmed calls and overdue recordings appear in the attention list.
- [x] Manager sees only own-team rows; another Manager's Telecaller is invisible; Telecaller / Advisor / Accounts → 403 (RBAC-01).
- [x] No full mobile number appears in any oversight response.
- [x] Web page renders the summary, filters and both tables; play uses the audited endpoint; fits 390 px.

## Progress notes
- Session 9 (done): shared `callAttention()`, `shareDeliveryLabel()`, `CALL_LIVE_WINDOW_MINUTES` (now also used by `CallsService` re-dial guard), `RECORDING_OVERDUE_MINUTES`, `Oversight*Query` (unit tests `packages/shared/test/oversight.test.ts`). API `OversightService`/`OversightController` in the calls module: `GET /calling/oversight/summary|calls|shares` (permissions `CALLING_RECORDS_READ_ALL|TEAM`; Manager scope = `actor.teamUserIds`, a Manager's `managerId` is ignored and another team's Telecaller → 404; IST day range, default last 7 days, max 1 year). No schema change, no writes.
- Definition kept consistent with F-702: "failed before provider" = FAILED **without** `providerCallId` (the adapter threw). The mock provider's refusal of `…0000` numbers returns a provider call id, so it counts as a provider-reported failure, not as failed-before-provider.
- Web `/admin/calling-list/oversight` ("Calls & delivery" nav item): filter form, attention chips (toggle filters, share chip switches to the shares tab), summary tiles with denominators, provider-state chips, top failure reasons, calls table with recording chip + audited Play, shares table with hand-off vs provider delivery labels, pagination.
- Tests: `apps/api/test/oversight.e2e-spec.ts` (6: summary numbers, WA-01, attention filters/CALL-02, no full mobiles, RBAC-01 scoping, date validation); Admin Playwright smoke now covers 3 oversight URLs at 1280 and 390 px. Browser-checked: attention filter, Play opens the provider link and writes one `SensitiveAccessLog` RECORDING/PLAYBACK row, nav highlights "Calls & delivery", no horizontal overflow.
- Follow-ups (not blocking): the same view for Managers on web/mobile (API already scopes Managers); telephony webhooks for unknown call ids are only logged, not stored, so they cannot be listed here.
