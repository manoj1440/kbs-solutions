# Android APK / AAB release (F-906)

## One-time setup
1. `cd apps/mobile && npx eas init` — links the Expo project and writes `expo.extra.eas.projectId` into `app.json` (commit it). Push tokens (F-701) need this id.
2. Signing: let EAS manage the Android keystore (`eas credentials -p android` → *Generate new keystore*). For local builds export the same keystore once (`eas credentials` → *Download*) and keep it in the secret manager — never in git. Losing it means the app can no longer be updated on devices.
3. Replace the placeholder API URLs in `apps/mobile/eas.json` (`preview` = UAT, `production` = production). `release-check` refuses `*.invalid`, `localhost` and `10.0.2.2`.

## Versioning
- `expo.version` in `app.json` is the user-visible version (semver; bump for every release). `runtimeVersion.policy = appVersion`.
- Build numbers (`versionCode`) come from EAS (`cli.appVersionSource: remote`, `autoIncrement: true` on preview/production), so two builds never share a code. Local builds read the same remote counter.

## Build
```bash
cd apps/mobile
eas build --platform android --profile preview           # internal APK for UAT (QR / link install)
eas build --platform android --profile preview --local   # same, on this machine (Android SDK + JDK 17 required)
eas build --platform android --profile production        # AAB for Play Console
```

## Release checklist (REQ-28 §28.2 — all must pass)
1. `pnpm release:check -- --profile=production` with `API_URL`, `ADMIN_TOKEN` (Admin access token for the target environment) and `API_ENV_FILE` (the deployed API env) → exit 0. It checks the build profile, production API settings (NODE_ENV, OTP provider, no dev master code, ClamAV scanning, S3, real secrets, non-owner `kbs_app` DB role, default request budget) and **every launch gate** (payout designated approver, training thresholds/reactivation window, compliance confirmations incl. calling-list consent, recording disclosure and WhatsApp policy, retention values, declarations).
2. CI green on the release commit (verify, api-e2e, web-e2e).
3. Maestro flows pass against the release APK: `maestro test apps/mobile/.maestro/`.
4. SEC-02: on an Android 12+ device, screenshots of protected screens (calling queue/desk, lead detail, payouts) are black and TalkBack still reads them (F-302).
5. k6 thresholds approved by KBS recorded in `DOCS/perf/01-baseline-results.md` (F-905), including the MIS preview/apply background-job decision.
6. Database: migrations applied as owner, API on `kbs_app` (`DOCS/runbooks/03-production-database.md`).
7. Record the version, build number, commit SHA and checklist evidence in the release notes.
