# F-302 Android protected screens (FLAG_SECURE) and residual-risk documentation

- Group: Telecaller ops · Status: **PLANNED** · Depends on: F-802
- PRD refs: REQ-09 §9.3 (platform secure-window facilities; policy scope: customer lists, PAN views, Advisor identity/bank records, call/payout materials; residual risks; do not claim prevention of every capture), REQ-20 §20.5 (do not silently block assistive tech), REQ-24 §24.5
- QA ids: SEC-02

## Detailed requirements
1. `<SecureScreen>` wrapper using `expo-screen-capture` `preventScreenCaptureAsync('kbs')` on mount / `allowScreenCaptureAsync` on unmount; applied to route groups: calling queue, calling desk, interaction detail, customer history, lead create/detail, advisor profile (bank), payout ledger/requests, recordings.
2. Root/compromised device: `expo-device` `isRootedExperimentalAsync` → show warning banner and record `SecurityEvent` (audit) — **not** a hard block (OPEN in PRD).
3. Documentation page `DOCS/runbooks/02-mobile-security-limits.md` listing what FLAG_SECURE does and does not prevent (external cameras, rooted devices, accessibility extraction) per PRD.

## Acceptance criteria
- [ ] SEC-02: manual test on Android 12+ shows black screenshot on protected screens; TalkBack still reads content.
- [ ] Unprotected marketing/onboarding screens (S01–S05) allow capture.
