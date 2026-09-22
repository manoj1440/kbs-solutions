# Mobile protected-screen limits (REQ-09 §9.3, SEC-02)

`SecureScreen` (apps/mobile/components/secure-screen.tsx) sets Android `FLAG_SECURE` through `expo-screen-capture` on protected surfaces: calling queue, calling desk, interaction history, lead creation/detail, Advisor bank/identity profile, payout ledger/requests, recordings.

What it does: blocks OS screenshots and screen recording of those screens and blanks them in the recent-apps switcher.

What it cannot do (residual risks the PRD asks us to state, never hide):
- photographing the screen with another device;
- rooted / compromised devices or modified OS builds that ignore the flag (we show a warning banner via `expo-device` root detection but do not hard-block — policy OPEN);
- accessibility services or screen readers reading content (deliberately not blocked, REQ-20 §20.5);
- data exfiltration through the network or copied text.

Verification checklist (F-302): on Android 12+ take a screenshot on the calling queue → black image; TalkBack still announces the content; welcome/onboarding marketing screens remain capturable.
