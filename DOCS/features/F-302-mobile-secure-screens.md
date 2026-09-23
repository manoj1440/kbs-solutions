# F-302 Android protected screens (FLAG_SECURE) and residual-risk documentation

- Group: Telecaller ops · Status: **IN_PROGRESS** · Depends on: F-802
- PRD refs: REQ-09 §9.3 (platform secure-window facilities; policy scope: customer lists, PAN views, Advisor identity/bank records, call/payout materials; residual risks; do not claim prevention of every capture), REQ-20 §20.5 (do not silently block assistive tech), REQ-24 §24.5
- QA ids: SEC-02

## Detailed requirements
1. `<SecureScreen>` wrapper using `expo-screen-capture` `preventScreenCaptureAsync('kbs')` on mount / `allowScreenCaptureAsync` on unmount; applied to route groups: calling queue, calling desk, interaction detail, customer history, lead create/detail, advisor profile (bank), payout ledger/requests, recordings.
2. Root/compromised device: `expo-device` `isRootedExperimentalAsync` → show warning banner and record `SecurityEvent` (audit) — **not** a hard block (OPEN in PRD).
3. Documentation page `DOCS/runbooks/02-mobile-security-limits.md` listing what FLAG_SECURE does and does not prevent (external cameras, rooted devices, accessibility extraction) per PRD.

## Acceptance criteria
- [ ] SEC-02: manual test on Android 12+ shows black screenshot on protected screens; TalkBack still reads content.
- [x] Unprotected marketing/onboarding screens (S01–S05) allow capture (policy unit test `lib/secure-routes.test.ts`; confirm on device in the SEC-02 run).

## Progress notes
- 2026-09-22 (session 1): `SecureScreen` component applied to the Telecaller home; runbook written. Pending: root-detection banner, manual SEC-02 verification on device.
- Session 8: resuming — route-level protection policy (one source of truth for protected screens, unit-tested), root/compromised-device warning banner + audited report, SEC-02 manual checklist.
- Session 8: code complete. Route policy `PROTECTED_ROUTES` (`apps/mobile/lib/secure-routes.ts`, unit-tested) + `ScreenProtection` in the root layout replaces per-screen wrappers (their unmount could re-allow capture when moving between two protected screens). Coverage extended to Advisor lead/payout/profile, Manager Telecaller/approvals/payout request and the onboarding gate. Root detection: `lib/device-integrity.ts` → `POST /auth/device-integrity` (audited, Admin SECURITY_EVENT once per session, `apps/api/test/device-integrity.e2e-spec.ts`) + dismissible warning banner; never blocks (policy OPEN). SEC-02 manual checklist in `DOCS/runbooks/02-mobile-security-limits.md`.
- **Remaining (stays IN_PROGRESS):** the SEC-02 manual run on a physical Android 12+ device with the preview APK — needs the Mac/EAS build (F-906); this workspace has no Android device.
