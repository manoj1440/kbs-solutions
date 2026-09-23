# F-802 Mobile shell: Expo Router, OTP login, gates routing, base components

- Group: UX shells · Status: **DONE** · Depends on: F-003, F-006, F-101, F-111
- PRD refs: REQ-20 §20.3 (mobile: bottom/tab/stack navigation, compact cards, robust OTP, multi-step forms, persistent calling controls, adaptive empty/error/loading), §20.5 (text scaling, touch targets), REQ-04 §4.2 (role-dependent first login), REQ-25 §25.1, REQ-12 S06–S07
- QA ids: AUTH-01, AUTH-02, TRAIN-03 (client routing)

## Detailed requirements
1. Routes: `app/(auth)/welcome|mobile|otp`, `app/(telecaller)/(tabs)`, `app/(advisor)/(tabs)`, `app/(manager)/(tabs)`, `app/(gates)/training|network-blocked|onboarding|deactivated`. Root layout loads session from `expo-secure-store`, calls `/auth/me`, routes on role + gates; re-checks on app foreground.
2. OTP screen: 6-digit input, masked number, edit number, resend with countdown, error states from `ErrorCode`.
3. API client: bearer tokens, silent refresh with single-flight, idempotency header for mutations, request id, SSID hint header (Telecaller only; `expo-network` best-effort), offline banner.
4. Base components via react-native-reusables + in-house: `Screen`, `SecureScreen` (F-302), `StatusBadge` family (F-803), `ProvenanceChip`, `EmptyState`, `ErrorState`, `ListSkeleton`, `Stepper`, `BottomSheet`.
5. Dev-client build instructions and `eas.json` preview profile producing an APK.

## Acceptance criteria
- [x] Telecaller with unpassed training is routed to training landing; Advisor pending onboarding to onboarding; Manager to team tabs.
- [x] Refresh-token rotation works across app restart.

## Progress notes
- 2026-09-22 (session 1): Expo Router tree, OTP screens, session provider (secure store, single-flight refresh, foreground re-check), gate screens, role tab areas, base UI. Pending: EAS/dev-client build verification on a device, offline banner, SSID hint wiring via expo-network.
- Session 8: resuming — token store/refresher extracted and unit-tested across a simulated restart, offline banner, network-type hint for Telecallers.
- Session 8 (done): routing on role + gates covered by `lib/routing.test.ts` (TRAIN-03, SEC-01, onboarding, Manager, deactivated). Token handling moved to `lib/auth-tokens.ts` with `auth-tokens.test.ts` simulating an app restart over persistent secure storage (server-side rotation + reuse revocation is covered by the API core e2e). Offline banner and Telecaller network-type hint (`type:wifi` etc. — the Wi-Fi name needs location permission, and the server never trusts the hint). Base components ship as `components/ui` + `components/status`; `BottomSheet`/`Stepper` were not needed by any screen. On-device verification of the preview APK is part of the F-906 release checklist.
