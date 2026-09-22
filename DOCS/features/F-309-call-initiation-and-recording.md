# F-309 In-app call initiation via telephony port, provider events, recordings

- Group: Telecaller ops · Status: **DONE** · Depends on: F-109, F-307, F-108
- PRD refs: REQ-08 §8.1 (sequence; live context retained), §8.2 (call ID, Telecaller, customer, target, times, provider result, duration; provider-confirmed states vs user outcome; recording via provider; failure + safe retry; no 'Recorded' unless retrievable; double-tap), REQ-16 §16.3 (attempts/connected definitions), REQ-21 §21.3, REQ-23 §23.3, INV-10, ADR-009
- QA ids: CALL-01, CALL-02, CALL-03

## Detailed requirements
1. `POST /calls {callingRecordId}` with `Idempotency-Key` — gated (training, network, not suppressed, record assigned to actor). Creates `CallAttempt(providerState=REQUESTED)`, calls `TelephonyProvider.initiateCall` with the customer's full number (server-side only), stores `providerCallId`. Failure → `providerState=FAILED, failureReason`, returned to client with retry allowed after 5 s.
2. Webhook `POST /webhooks/telephony/:provider` (signature verified by adapter) → events update `providerState`, `connectedAt`, `endedAt`, `durationSec`; `RECORDING_AVAILABLE` → `CallRecording(status=AVAILABLE, fileId or providerRecordingId)`; `RECORDING_FAILED` → `FAILED`. Duplicate events idempotent.
3. Client polls `GET /calls/:id` (or SSE later) to show states: requesting connection, ringing (if supported), connected, ended, failed, no answer; recording chip shows `Recording available | Recording unavailable | Not attempted` — never "Recorded" without an AVAILABLE row (CALL-02).
4. Playback: `GET /calls/:id/recording-url` for assigned Manager/Admin (`RECORDING_PLAY`) → presigned URL; logs `SensitiveAccessLog`.
5. Metrics definitions implemented here: attempt = `CallAttempt` row; connected = `providerState` reached `CONNECTED` per provider event (never from outcome).
6. Compliance: `compliance.recordingDisclosureText` shown to Telecaller as a script line before dialing when set; when null, banner "recording disclosure not configured" for Admin (launch gate).
7. Mobile calling desk: persistent call control bar (state, timer, end/retry), customer summary, card list, share actions, outcome editor — all on one screen.

## Acceptance criteria
- [x] CALL-01: mock provider sequence → attempt has providerCallId, CONNECTED/ENDED times, duration on the right calling record.
- [x] CALL-02: RECORDING_FAILED → chip "Recording unavailable"; AVAILABLE → playable by Manager/Admin only.
- [x] Double-tap with same idempotency key → one attempt.

## Progress notes
- 2026-09-22 (session 2): `CallsService`: `POST /calls` (CALL_INITIATE + training/network gates + `@Idempotent`; `CallAttempt.idempotencyKey` makes a same-key double-tap return the same attempt; refuses suppressed (403 CALLING_SUPPRESSED), hidden, unassigned, live-call-in-progress (409), retry within 5 s of a FAILED attempt (429 with `retryAfter`)); provider gets the full E.164 only server-side, every initiation logs a `SensitiveAccessLog(MOBILE, CALL_INITIATE)`; `GET /calls/:id` (scoped: own / team / all); `GET /calling/records/:id/calls`; `POST /webhooks/telephony/:provider` (public; adapter parses/verifies; RINGING/CONNECTED/ENDED (duration computed from connectedAt when the provider omits it; ENDED without CONNECTED → NO_ANSWER; creates `CallRecording(PENDING)` after a connected call)/NO_ANSWER/FAILED/RECORDING_AVAILABLE/RECORDING_FAILED; duplicates and unknown call ids ignored, `{received, applied}` returned); `GET /calls/:id/recording-url` (RECORDING_PLAY, Telecaller 403, only AVAILABLE, `SensitiveAccessLog(RECORDING, PLAYBACK)` + audit). `CallAttemptView.disclosureText` carries `compliance.recordingDisclosureText`; `recordingChip()` in shared maps status → label, never "Recorded" without AVAILABLE. Mobile `components/call-desk.tsx`: call bar (state, timer from provider timestamps, retry, recording chip, disclosure line) + outcome editor, embedded in the record screen with the card list. `API_PUBLIC_URL` env added for the callback URL. e2e `calls.e2e-spec.ts`.
