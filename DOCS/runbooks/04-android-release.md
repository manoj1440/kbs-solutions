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
eas build --platform android --profile device            # F-818: internal APK against a developer Mac on the LAN
```

`eas` is not installed globally on the Mac — use `npx eas-cli@latest …`. Project: `d52957fe-d8b8-497b-ac7c-52ca691f43be` (owner `manojskidoss-team`, slug `kbs`).

**`device` profile (F-818):** extends `preview`, points `EXPO_PUBLIC_API_URL` at the developer Mac (`http://192.168.31.215:4000/api/v1` — update when the Mac's Wi-Fi IP changes: `ipconfig getifaddr en0`) and sets `APP_VARIANT=device`. `app.config.js` turns on `usesCleartextTraffic` for that variant only, so preview/production stay https-only. To use it: run the API with `pnpm dev` (it listens on all interfaces, port 4000), keep the phone on the same Wi-Fi, allow incoming connections if macOS asks. Never ship this APK.

**JS-only fixes without a new APK (EAS Update):** the `device` build listens on channel `device` (runtime `0.1.0`). `apps/mobile/.env` (git-ignored, `localhost`) would win over the shell, so turn dotenv off and pass the build's values:
```bash
cd apps/mobile && EXPO_NO_DOTENV=1 APP_VARIANT=device EXPO_PUBLIC_API_URL=http://192.168.31.215:4000/api/v1 \
  npx eas-cli@latest update --channel device --platform android --environment preview --message "…"
```
The phone downloads it on launch and applies it on the next launch (close and reopen the app twice). Native changes (new modules, app.json plugins) still need a build.

**Monorepo build notes (F-818):** EAS runs `eas-build-post-install` (builds `@kbs/shared` / `@kbs/ui-tokens`, whose `dist/` is git-ignored); `babel-preset-expo` is a mobile devDependency; root `.npmrc` publicly hoists `@babel/*` because NativeWind's preset loads `@babel/plugin-transform-react-jsx` by name. Local proof before spending a cloud build: `cd apps/mobile && APP_VARIANT=device npx expo prebuild --platform android --no-install` (then delete `android/`) and `npx expo export --platform android`.

## Release checklist (REQ-28 §28.2 — all must pass)
1. `pnpm release:check -- --profile=production` with `API_URL`, `ADMIN_TOKEN` (Admin access token for the target environment) and `API_ENV_FILE` (the deployed API env) → exit 0. It checks the build profile, production API settings (NODE_ENV, OTP provider, no dev master code, ClamAV scanning, S3, real secrets, non-owner `kbs_app` DB role, default request budget) and **every launch gate** (payout designated approver, training thresholds/reactivation window, compliance confirmations incl. calling-list consent, recording disclosure and WhatsApp policy, retention values, declarations).
2. CI green on the release commit (verify, api-e2e, web-e2e).
3. Maestro flows pass against the release APK: `maestro test apps/mobile/.maestro/`.
4. SEC-02: on an Android 12+ device, screenshots of protected screens (calling queue/desk, lead detail, payouts) are black and TalkBack still reads them (F-302).
5. k6 thresholds approved by KBS recorded in `DOCS/perf/01-baseline-results.md` (F-905), including the MIS preview/apply background-job decision.
6. Database: migrations applied as owner, API on `kbs_app` (`DOCS/runbooks/03-production-database.md`).
7. Record the version, build number, commit SHA and checklist evidence in the release notes.
