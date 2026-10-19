# F-818 — Mobile: glass UI + the web palette (cream, near-black, orange, teal)

- Group: UX shells · Status: **IN_PROGRESS** · Depends on: F-805 (mobile design system), F-817 (web reference look, glass, palette)
- PRD refs: REQ-20 (UX/visual constraints: text always carries meaning, contrast, motion), REQ-12 (29-screen experience map)
- Origin: user request (2026-10-19): "in the phone app I would like to add this glass UI design as well".

## 0. Decisions (user, 2026-10-19)
| Topic | Decision |
|---|---|
| Glass | **Real blur** with `expo-blur` (`BlurView`; Android uses `experimentalBlurMethod="dimezisBlurView"`). New native module → a new APK build is needed to see it on a phone. |
| Palette | **Match the web (F-817):** cream canvas, warm-white surfaces, near-black primary, orange hero accent (`#F05A28`), teal for positive. Replaces F-805 navy/indigo + gold (supersedes the F-815 "keep indigo + gold" decision). |
| Light only | Mobile stays light (F-805 `darkMode: 'class'`, no dark variants). Dark mode on mobile is not part of this feature. |
| Where glass goes | Floating tab bar, app bars, bottom sheets, hero overlays and KPI tiles; ambient orange / teal light behind screens. Lists, forms and bank-status rows stay on solid surfaces for legibility (same rule as web). |
| Verification | Expo web at 390×844 (F-805/F-815 method). `react-native-web`, `react-dom`, `@expo/metro-runtime` become **devDependencies** of `apps/mobile` so previews need no temporary installs (memory: temporary installs broke `next dev`). Native Android rendering is not verified here (no Android SDK on this Mac). |

## 1. Phases
| Phase | Scope | Status |
|---|---|---|
| P0 | Before screenshots (Expo web 390×844) | |
| P1 | Tokens: `lib/theme.ts` + `tailwind.config.js` to the web palette; hard-coded F-805 hexes mapped | |
| P2 | Glass primitives: `Glass` (BlurView wrapper + tint + edge), `AmbientBackground`; `Card variant="glass"` | |
| P3 | Apply: tab bar, AppBar, HeroHeader, BottomSheet, StatTile, home KPI cards | |
| P4 | Checks: typecheck, lint, unit; after screenshots; web workspace still green | |

## 2. Acceptance
- [ ] No F-805 navy / indigo / gold hex left in `apps/mobile` (card-art palettes excepted).
- [ ] Tab bar, app bars and sheets are frosted over content.
- [ ] Every role home and list renders at 390×844 with no clipped text.
- [ ] Mobile typecheck / lint / unit green; web e2e still green after the dependency change.

## Progress notes
