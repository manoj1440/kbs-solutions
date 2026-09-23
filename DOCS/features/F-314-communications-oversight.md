# F-314 Telephony, WhatsApp delivery and recording oversight

- Group: Telecaller ops · Status: **IN_PROGRESS** · Depends on: F-309, F-310, F-311, F-313
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
- [ ] Admin summary separates provider-confirmed attempts from failures before the provider, and connected only from provider `connectedAt`.
- [ ] Recording coverage uses connected calls as denominator; a FAILED recording is never counted or shown as available (CALL-02).
- [ ] A hand-off share is never counted as delivered; provider FAILED delivery appears in attention (WA-01).
- [ ] Stale un-confirmed calls and overdue recordings appear in the attention list.
- [ ] Manager sees only own-team rows; another Manager's Telecaller is invisible; Telecaller / Advisor / Accounts → 403 (RBAC-01).
- [ ] No full mobile number appears in any oversight response.
- [ ] Web page renders the summary, filters and both tables; play uses the audited endpoint; fits 390 px.

## Progress notes
- Session 9: started.
