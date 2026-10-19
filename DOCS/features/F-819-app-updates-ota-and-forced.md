# F-819 — Mobile app updates: automatic OTA + forced native update

- Group: UX shells · Status: **IN_PROGRESS** · Depends on: F-818 (EAS project, `device` profile, expo-updates), F-104 (SystemConfig)
- PRD refs: REQ-24 (operational acceptance), REQ-28 §28.2 (release gate)
- Origin: user request (2026-10-19): "fix the OTA updates which is quite important as I don't want the client to update the APK manually, and also add a forceful feature in the app if we want to update the app manually from Android or iOS".

## 0. Findings (OTA "did not apply")
- Build wiring is correct: `expo-updates` enabled, check on launch `ALWAYS`, runtime `0.1.0` (`runtimeVersion.policy: appVersion`), request header `expo-channel-name: device`, update URL `https://u.expo.dev/d52957fe…`. Updates `abcebe66` / `6bcd3b43` were published to branch/channel `device`, runtime `0.1.0`.
- The S24 screenshot that showed `built-in` was build `f10a9473`, built **after** both updates; expo-updates launches the newest of embedded vs downloaded, so the embedded bundle correctly won.
- For the earlier build, the published updates only carried an ineffective keyboard fix and there was no version line yet, so "not applied" could not be told apart from "applied". Default behaviour also applies an update only on the **next** cold start, which reads as "nothing happened".
- Conclusion: no evidence of a broken OTA path; the gap is behaviour (apply on next launch, silent). Fixed by applying updates immediately (below) and proven end-to-end in P4.

## 1. Decisions (auto-approved per the user's standing instruction)
| Topic | Decision |
|---|---|
| OTA on launch | `UpdateGate` at the app root: check → if an update exists, full-screen "Updating KBS Solutions…", download, **restart into it immediately**. Offline / error / >10 s check → open the app normally; a background download that finishes later triggers the restart prompt. |
| OTA on resume | On returning to the foreground (at most every 15 min) check + download in the background; when ready show a non-dismissable "Update ready — Restart now" sheet. |
| Native forced update | SystemConfig keys `app.{android,ios}.{minVersion,latestVersion,downloadUrl}`; public `GET /app/version`. Installed version < `minVersion` → blocking "Update required" screen (Download button opens `downloadUrl`; nothing else reachable). < `latestVersion` → dismissible "New version available" once per session. Defaults: min `0.0.0`, latest/url unset → no prompt. |
| Version source | `Constants.expoConfig.version` (= app.json `version` = runtime version). A native release bumps `version`; OTA updates only reach installs with the same version. |
| Dev / web | Gate is a no-op when `Updates.isEnabled` is false (dev client, Expo web). |

## 2. Phases
| Phase | Scope | Status |
|---|---|---|
| P1 | Shared: config keys, `compareVersions`, `appUpdateState` (+ unit tests) | |
| P2 | API: `@Public() GET /app/version` (+ e2e) | |
| P3 | Mobile: `UpdateGate` (OTA launch/resume, required/available native) at the root | |
| P4 | Web: "Mobile app" group on Configuration; runbook release flow; APK build; prove OTA end-to-end on the S24 | |

## 3. Acceptance
- [ ] Publishing `eas update --channel device` changes the login version line to `update xxxxxxxx` on the next app open, without reinstalling.
- [ ] Setting `app.android.minVersion` above the installed version blocks the app with "Update required" and a working download link.
- [ ] Offline launch still opens the app.
- [ ] Shared/API/mobile tests green.

## Progress notes
