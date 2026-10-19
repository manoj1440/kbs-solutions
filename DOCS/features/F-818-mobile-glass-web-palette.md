# F-818 — Mobile: glass UI + the web palette (cream, near-black, orange, teal)

- Group: UX shells · Status: **DONE** (APK opens on a Galaxy S24; glass on device not yet reviewed in detail) · Depends on: F-805 (mobile design system), F-817 (web reference look, glass, palette)
- PRD refs: REQ-20 (UX/visual constraints: text always carries meaning, contrast, motion), REQ-12 (29-screen experience map)
- Origin: user request (2026-10-19): "in the phone app I would like to add this glass UI design as well".

## 0. Decisions (user, 2026-10-19)
| Topic | Decision |
|---|---|
| Glass | **Real blur** with `expo-blur` (`BlurView`; Android uses `blurMethod="dimezisBlurViewSdk31Plus"` against a `BlurTargetView`). New native module → a new APK build is needed to see it on a phone. |
| Palette | **Match the web (F-817):** cream canvas, warm-white surfaces, near-black primary, orange hero accent (`#F05A28`), teal for positive. Replaces F-805 navy/indigo + gold (supersedes the F-815 "keep indigo + gold" decision). |
| Light only | Mobile stays light (F-805 `darkMode: 'class'`, no dark variants). Dark mode on mobile is not part of this feature. |
| Where glass goes | Floating tab bar, app bars, bottom sheets, hero overlays and KPI tiles; ambient orange / teal light behind screens. Lists, forms and bank-status rows stay on solid surfaces for legibility (same rule as web). |
| Verification | Expo web at 390×844 (F-805/F-815 method). `react-native-web`, `react-dom`, `@expo/metro-runtime` become **devDependencies** of `apps/mobile` so previews need no temporary installs (memory: temporary installs broke `next dev`). Native Android rendering is not verified here (no Android SDK on this Mac). |

## 1. Phases
| Phase | Scope | Status |
|---|---|---|
| P0 | Before screenshots (Expo web 390×844) | DONE |
| P1 | Tokens: `lib/theme.ts` + `tailwind.config.js` to the web palette; hard-coded F-805 hexes mapped | DONE |
| P2 | Glass primitives: `Glass` (BlurView wrapper + tint + edge), `GlassScope` (ambient light target); `Card variant="glass"` | DONE |
| P3 | Apply: tab bar, StickyFooter, BottomSheet, StatTile / glass cards, IconButtons; HeroHeader recoloured (charcoal → orange), AppBar unchanged (sits on the ambient canvas) | DONE |
| P4 | Checks: typecheck, lint, unit; after screenshots; web workspace still green | DONE |

## 2. Acceptance
- [x] No F-805 navy / indigo / gold hex left in `apps/mobile` (card-art palettes excepted).
- [x] Tab bar, app bars and sheets are frosted over content.
- [x] Every role home and list renders at 390×844 with no clipped text.
- [x] Mobile typecheck / lint / unit green; web e2e still green after the dependency change.

## Progress notes
- 2026-10-19 (session 20): built in one session.
- Deps: `expo-blur ~57.0.3` (dependency); `react-native-web ~0.21.0`, `react-dom 19.2.3`, `@expo/metro-runtime ~57.0.16` (devDependencies, Expo-web preview only). Lockfile re-hashed some web eslint peers; web lint / typecheck / Playwright stay green.
- Tokens: `lib/theme.ts` + `tailwind.config.js` keep the F-805 *names* but now hold the web palette (navy/ink/brand = `#1C1917`, indigo/gold = `#F05A28`, canvas `#F2EEE8`, success/info teal); new `orange`, `teal`, `surface` keys. 46 files had F-805 hexes mapped (navy, indigo, gold, cool greys → warm greys); the purple bank-provenance colours stay (web keeps them too). Hero gradient = charcoal → ember → orange (white text sits on the dark end); primary button = solid near-black pill; gold button = orange gradient with white text; buttons / segmented controls are pills.
- Glass: `components/ui/glass.tsx` — `GlassScope` (cream + three radial ambient glows inside a `BlurTargetView`) wraps every `Screen` and each role tab layout; `Glass` blurs the nearest scope (`blurMethod: dimezisBlurViewSdk31Plus`, tint fallback below Android 12 or without a scope, e.g. inside a `Modal`). Applied to: tab bar (frosted pill, black active pill, orange raised action), `StickyFooter`, `BottomSheet`, `StatTile`, `Card variant="glass"`, plain `IconButton`s (translucent). Lists, forms, bank-status rows stay solid.
- Expo web preview without temporary installs: `lib/secure-store.ts` (+ `.web.ts` localStorage stand-in, never bundled into the APK) so web runs; API needs `WEB_ORIGIN` to include `http://localhost:8081`. Screenshot method: tokens from the OTP API put into `localStorage` (`kbs.access` / `kbs.refresh`), 390×844. Before/after: welcome, Advisor (home, leads, cards, earnings), Manager (team, advisors, approvals, profile), Telecaller (training gate), dev gallery, login.
- Checks: mobile typecheck / lint / unit 11/11; workspace typecheck 9/9; web Playwright isolated 74 passed / 2 skipped.
- **Not verified:** native Android rendering of the blur (no Android SDK on this Mac). Needs a new APK (`expo-blur` is a native module): `cd apps/mobile && eas build -p android --profile preview` (runbook `DOCS/runbooks/04-android-release.md`), then check the tab bar / sheets on an Android 12+ phone and an older one (tint fallback).
- Out of scope: mobile copy still says "MIS" in places (F-816 was web only); mobile dark mode.
- 2026-10-19, first cloud build (user ran `eas login` + `eas init`, project `d52957fe…`, owner `manojskidoss-team`, slug `kbs`): `device` profile (LAN API, cleartext only for `APP_VARIANT=device` via `app.config.js` + `expo-build-properties`). Four failed builds fixed in turn: (1) `assets/adaptive-icon.png` missing → new orange "K" icon set + adaptive / monochrome icon config; (2) workspace packages not built on EAS → `eas-build-post-install` builds `mobile^...`; (3) `babel-preset-expo` not declared → devDependency; (4) css-interop's Babel preset names `@babel/plugin-transform-react-jsx` without declaring it → `.npmrc` `public-hoist-pattern[]=@babel/*` (defaults for eslint/prettier repeated). Build 5 `800acedd` FINISHED (internal APK). Also removed deprecated `edgeToEdgeEnabled`, `newArchEnabled`, `android.versionCode`; `expo doctor` still reports 16 SDK version mismatches (follow-up, not blocking).
- 2026-10-19, crash on Galaxy S24 (build `800acedd` closed instantly, no splash). No device log available (no adb on the Mac); most likely cause: native modules on versions built for other SDKs (`expo-image-picker` 17.x, gesture-handler 3.3, reanimated 4.7 / worklets 0.13, screens 4.28, safe-area 5.10) — the app had never been built natively before. Aligned every native module to SDK 57's versions (typescript 5.9 kept, listed in `expo.install.exclude`), added `expo-splash-screen` (SDK 57 ignores top-level `splash`) and `expo-system-ui`, `userInterfaceStyle: light`. `expo-doctor` 21/21, local prebuild clean, Android bundle exports, web checks green. Rebuild `921ade7d` FINISHED — **user confirmed it opens on the Galaxy S24** (2026-10-19).
- 2026-10-19, S24: Login / Send OTP button hidden behind the keyboard — Android 15+ is edge-to-edge, so `adjustResize` no longer shrinks the window. `Screen` and `BottomSheet` now wrap content in `KeyboardAvoidingView` (padding); `AuthShell` collapses its header while the keyboard is open. Shipped as EAS Update `abcebe66` on channel `device` (no reinstall). Found on the way: local bundling reads `apps/mobile/.env` (`localhost`) over shell env — use `EXPO_NO_DOTENV=1` for updates (runbook 04).
- 2026-10-19, S24 follow-up: the button was missing even with the keyboard closed — not a keyboard-overlap issue. Likely cause: `autoFocus` opened the keyboard ~0.1 s after mount and the re-layout interrupted the staggered `Appear` entrance of later items (submit button, sign-up link), leaving them invisible. Fix: `useDeferredFocus` (focus after the entrance, 650 ms) replaces `autoFocus` on login, OTP and Create Telecaller; login / OTP submit areas render without an entrance animation. EAS Update `6bcd3b43` on channel `device` — **did not reach the phone** (still `built-in`); cause of the OTA miss not found yet.
- 2026-10-19, S24 screenshot: the Login button's slot was ~38 dp with no background (white text on white) and IconButton circles were missing — NativeWind `className` on Reanimated-wrapped components (`AnimatedPressable`, `Animated.View`) is not applied on Android (it is on web, so previews looked right). `PressableScale` → plain `Pressable` (`active:opacity-80`); `Appear` animates an outer view around a plain classed `View`; skeleton, sheet, backdrop, tab / segmented pills, progress, OTP cursor, welcome dots / bars, lead-created badge use inline styles. Rule for the kit: **no `className` on Reanimated components.** APK `cede758d` (also shows `v0.1.0 · built-in|update xxxx` on login). Awaiting confirmation on the S24.

