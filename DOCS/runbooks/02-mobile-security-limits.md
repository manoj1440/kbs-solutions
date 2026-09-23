# Mobile protected-screen limits (REQ-09 §9.3, SEC-02)

`ScreenProtection` (apps/mobile/components/secure-screen.tsx), mounted once in the root layout, sets Android `FLAG_SECURE` through `expo-screen-capture` whenever the current route is in the policy list `PROTECTED_ROUTES` (apps/mobile/lib/secure-routes.ts, unit-tested in `secure-routes.test.ts`):

| Role | Protected screens |
|---|---|
| Telecaller | calling queue (home), customer record / calling desk, customer card, official ID card |
| Advisor | home, new lead (PAN), lead detail / created / list, payout ledger and requests, profile (bank details) |
| Manager | team home, Telecaller detail (customer call history), payout approvals and request detail |
| Gates | onboarding (identity and bank details) |

Capturable by design: welcome / sign-in / OTP (S01–S05), card catalogue and card detail (marketing content), training, network-blocked and deactivated notices, notifications.

What it does: blocks OS screenshots and screen recording of those screens and blanks them in the recent-apps switcher. Because it is route-driven from one place, moving between two protected screens never briefly re-allows capture.

Root / compromised devices: after sign-in the app runs `expo-device` `isRootedExperimentalAsync()` and reports the result to `POST /auth/device-integrity` (audited as `security.deviceIntegrity`; a rooted device raises one Admin SECURITY_EVENT per session). The user sees a dismissible warning banner. Access is **not** blocked — hard-blocking is policy OPEN. The check is heuristic and can be evaded.

What it cannot do (residual risks the PRD asks us to state, never hide):
- photographing the screen with another device;
- rooted / compromised devices or modified OS builds that ignore the flag;
- accessibility services or screen readers reading content (deliberately not blocked, REQ-20 §20.5);
- data exfiltration through the network or copied text.

## SEC-02 manual verification (release evidence — cannot be automated in CI)
Run on a physical Android 12+ device with the `preview` APK (see 04-android-release.md). Record device model, Android version, APK build number, date and tester.
1. Sign in as a Telecaller on an office network. On the calling queue press Power + Volume-down → the saved screenshot is black (or Android reports the app does not allow screenshots).
2. Open a customer record → same result. Start a screen recording from quick settings → the protected screen records as black.
3. Open recent apps → the KBS preview is blank.
4. Turn on TalkBack → queue items and the record are still announced (content is not hidden from assistive tech).
5. Sign out; on the welcome and sign-in screens take a screenshot → it is captured normally.
6. As an Advisor: new lead, payouts and profile are black in screenshots; the card catalogue is capturable.
7. (If a rooted test device is available) sign in → warning banner appears, the app keeps working, and the Admin gets a "rooted / compromised device" notification.
