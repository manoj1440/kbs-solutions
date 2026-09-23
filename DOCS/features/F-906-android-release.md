# F-906 Android APK build and release checklist

- Group: Hardening · Status: **DONE** · Depends on: F-802, F-302
- PRD refs: REQ-02 §2.1 (Android APK), REQ-24 §24.5, REQ-28 §28.2 (release gates)

## Scope
EAS/local Gradle build for `preview` APK, signing config, version/build numbering, release checklist that includes the launch-gate config items and compliance gates.

## Progress notes
- `apps/mobile/eas.json`: `development` (dev client APK), `preview` (internal APK, channel preview), `production` (AAB, channel production); `cli.appVersionSource: remote` + `autoIncrement` so build numbers never collide; per-profile `EXPO_PUBLIC_API_URL` (placeholders `*.example.invalid` must be replaced — the release check refuses them).
- `app.json`: `versionCode`, `runtimeVersion.policy = appVersion`, `expo-notifications` plugin, `POST_NOTIFICATIONS`; hard-coded dev `extra.apiUrl` removed (the app reads `EXPO_PUBLIC_API_URL`).
- Push (closes the F-701 follow-up): `lib/push.ts` registers the Expo push token after sign-in (skipped without a physical device, permission or EAS projectId) and routes push taps to the role's notification centre.
- Signing: EAS-managed keystore; local builds use the downloaded keystore from the secret manager (never in git) — `DOCS/runbooks/04-android-release.md`.
- `pnpm release:check` (`scripts/release-check.mjs`): build profile, production API env (NODE_ENV, OTP provider, no dev master code, ClamAV, S3, secrets, `kbs_app` role, request budget) and every launch gate from the live API; exit 1 on any failure; prints the manual evidence list (Maestro flows, SEC-02, KBS-approved perf thresholds, compliance sign-offs). Verified against the local dev stack: fails closed on the 10 open launch gates and the dev env.
- **Not done here:** an actual APK build — this workspace has no Android SDK/JDK and no EAS login. Next step on the Mac: `cd apps/mobile && npx eas init && eas build -p android --profile preview` (or `--local`), then run the Maestro flows on the APK.
