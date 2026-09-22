# F-109 Provider ports and mock adapters

- Group: Core · Status: **DONE** · Depends on: F-003 · ADR-009
- PRD refs: REQ-02 §2.2 (support providers may be needed; no bank-status integration), REQ-08 §8.2 (provider-confirmed states), §8.5 (share-sheet ≠ delivered), REQ-10 §10.2 (lawful Aadhaar options), REQ-28 §28.1, INV-10

## Detailed requirements
Interfaces (in `apps/api/src/providers/ports`), each with a `console`/`mock` adapter and DI token, selected by env:
1. `OtpProvider.send(mobile, code)` → `{accepted, providerRef}`. Console adapter logs `[dev-otp] <masked mobile> <code>` outside production.
2. `TelephonyProvider.initiateCall({fromUserId, toMobile, callbackUrl})` → `{providerCallId, state}`; `parseWebhook(req)` → typed events `RINGING | CONNECTED | ENDED | FAILED | NO_ANSWER | RECORDING_AVAILABLE | RECORDING_FAILED`. Mock adapter simulates a scripted sequence via a dev endpoint.
3. `WhatsAppProvider` — two modes: `HANDOFF` (returns a `wa.me` deep link; delivery unknown) and `BUSINESS_API` (send template/media; returns `providerMessageId`; webhook → `SENT | DELIVERED | FAILED`).
4. `KycProvider.startAadhaarVerification(userId, consent)` → `{sessionRef, instructions}`; `completeVerification(sessionRef, payload)` → `{status: VERIFIED | FAILED, providerRef, evidenceSummary (no Aadhaar number)}`. Mock: verifies when payload `"MOCK_OK"`.
5. `PanVerificationProvider.verify(pan, name?)` → `{status: VERIFIED | MISMATCH | FAILED | UNAVAILABLE, providerRef}`. Mock: valid regex → VERIFIED.
6. `StorageProvider` (S3, memory). 7. `PushProvider` (Expo push; mock). 8. `ScanProvider` (`noop` → SKIPPED; ClamAV later F-902).
9. **Forbidden:** any `BankStatusProvider` — a lint rule/grep test fails the build if a file matches `/bank.*status.*provider/i` in `providers/`.

## Acceptance criteria
- [x] App boots with all providers on mock/console adapters and no vendor credentials.
- [x] Each port's contract test runs against its mock adapter.
- [x] Every result type has an explicit `confirmed`/status field — no boolean "success" that could be misread as delivery/recording.

## Progress notes
- 2026-09-22 (session 1): Ports + console/mock/handoff/memory/noop adapters wired by env; no bank-status port (grep test to add in F-901).
