# F-805 Mobile UI revamp — premium fintech design system and every screen

- Group: UX shells · Status: **DONE** · Depends on: F-802, F-803
- PRD refs: REQ-20 (shared tokens §20.1, text never colour-only §20.2, adaptive states §20.3, large touch targets / accessibility §20.5), REQ-25 (role screen inventory), REQ-12 (OTP-only auth)
- Origin: user request (2026-09-23) — "completely revamp the mobile UI in a very impressive and intuitive way". Direction chosen by the user: **premium fintech** (deep navy/indigo gradient headers, gold accents, real vector icons, motion), **every screen, all roles**.

## 1. Audit of the current mobile UI (before)

Read every file under `apps/mobile/app`, `components`, `lib` (~5.6k lines, 45 screens across auth, gates, Advisor, Manager, Telecaller).

### Defects (real bugs, not taste)
| # | Where | Problem |
|---|---|---|
| D1 | `components/ui` `Screen` | No safe-area handling (`pt-6` fixed) while `android.edgeToEdgeEnabled` is on → headers sit under the status bar / camera cut-out on modern phones; bottom content can sit under the gesture bar. |
| D2 | `(manager)/index` | Team rows navigate with `onTouchEnd` → a scroll that ends on a row opens it. Summary tiles sit outside the `FlatList`, so on a phone the list is squeezed into the remaining space instead of scrolling with the page. |
| D3 | Tab layouts | Manager and Telecaller tab bars have no icons at all; Advisor uses emoji glyphs (render differently per OEM, not tintable, no accessible labels). |
| D4 | `StatusBar style="auto"` | On a phone in system dark mode the status-bar icons turn white over the light app background (the app itself is light-only). |
| D5 | Back navigation | "← Back" ghost buttons inside the scroll content: they scroll away, are inconsistent, and are sometimes missing. |
| D6 | Loading | Most screens show nothing (or "Loading…") while fetching; pull-to-refresh is the only feedback. |

### UX / visual problems
- **No hierarchy.** Everything is a bordered white `Card` with `text-base`; titles, values and meta text look alike. Numbers (earnings, counts) are not emphasised.
- **Emoji as iconography** (🔔 📋 💰 ✈️ …) across home, quick actions, welcome, training — reads as a prototype, not a banking-grade product.
- **Filters as inline expanding cards** (My Leads) push the list off-screen; should be a bottom sheet with an "Apply" affordance.
- **Status chips are solid saturated blocks**; three per lead row become visually loud. Softer tinted chips carry the same text + tone (REQ-20 §20.2 unchanged: label always present).
- **Empty / error states** are plain text cards without guidance or an action.
- **No motion.** No press feedback beyond opacity, no entrance transitions, tab changes are abrupt.
- **Typography** is the system font at default weights; no numeric emphasis.
- **Card art** is a flat tinted rectangle; the catalogue is the Advisor's storefront and should look like real cards.

## 2. Design direction (after)

**Premium fintech, light-first.** Deep navy → indigo gradient hero headers that curve into a soft grey canvas; white elevated surfaces with gentle shadows instead of hairline borders; gold accent for money and primary moments; Inter typeface with a clear scale; Ionicons vector icons everywhere; subtle spring/entrance motion.

### Principles
1. **One glance = one answer.** Each home screen leads with the number that matters for the role (Advisor: earnings + funnel; Manager: team activity; Telecaller: due-now + queue).
2. **Thumb-first.** Primary actions in the bottom half (floating "New lead" action in the Advisor tab bar, sticky bottom CTAs on forms), ≥44 pt targets (REQ-20 §20.5).
3. **Bank truth stays visually distinct.** Stage / Decision / Activation badges stay three separate labelled chips; provenance chips keep their own colours; nothing in the redesign merges or recolours bank values into "success/failure" (INV-01…03 unaffected — this is a presentation-only change).
4. **Every state designed.** Skeleton while loading, illustrated empty state with a next step, inline error with retry.
5. **No new native modules.** Only JS/asset packages that work in the existing dev-client/APK: `@expo/vector-icons`, `@expo-google-fonts/inter` (loaded by `expo-font`, already linked by `expo`). Gradients and shadows use React Native's built-in `experimental_backgroundImage` / `boxShadow` (new architecture). Motion uses the already-installed Reanimated 4. No UI kit (ADR-003 respected).

### Design system (apps/mobile/components/ui)
- **Tokens** `lib/theme.ts`: brand colours (navy `#0A1E42`, ink `#0B1533`, brand `#16329E`, indigo `#3D5AFE`, gold `#F5B942`), canvas `#F4F6FB`, gradients, elevation presets, per-bank card-art palettes. Tailwind gains `canvas`, `navy`, `brand`, `gold`, `ink` colours and Inter font utilities (`font-medium/semibold/bold/extrabold` map to Inter faces).
- **Primitives:** `Text`, `Heading`, `Display`, `Muted`, `Overline`, `Icon`, `Gradient`, `PressableScale`, `Button` (variants default / secondary / outline / ghost / destructive / gold; sizes; icons; loading), `IconButton`, `Input` (label, left icon, error, hint, focus ring), `Card` (elevated / outline / tinted, optional `onPress`), `Badge` (soft tinted, optional icon), `Chip`, `Segmented` (animated pill), `Avatar` (initials), `IconCircle`, `ProgressBar`, `Divider`, `Skeleton`, `KeyValue`, `Callout` (info / warning / danger / success), `SectionHeader`, `ListItem`, `EmptyState`, `ErrorState`, `StatTile`, `BottomSheet`, `StickyFooter`.
- **Layout:** `Screen` (safe areas, canvas background, optional scroll + pull-to-refresh), `AppBar` (back, title, subtitle, actions — replaces "← Back" buttons), `HeroHeader` (gradient, curved bottom, overlapping content).
- **Navigation:** custom `TabBar` — white floating bar, Ionicons, animated active pill, badge dots, optional centre action (Advisor "New lead").
- **Domain:** `CreditCardArt` (gradient card with chip, contactless mark, bank + card name; deterministic palette per bank), restyled `LeadRow`, status badges with soft tones, notification list with icons by entity type.

## 3. Screen-by-screen plan
- **Auth:** welcome carousel on a full navy gradient with animated card stack and pagination; mobile + OTP screens on a navy hero with a white sheet, +91 prefix field, animated OTP boxes.
- **Gates:** training (progress ring/bar, module timeline), module, assessment (question cards, option radios, result), onboarding (stepper with progress), deactivated / network-blocked (illustrated full-screen states).
- **Advisor:** Home (gradient hero with earnings, funnel stats, quick actions grid, recent activity), Leads (search, filter bottom sheet, draft carousel, lead cards), Lead detail (hero summary, status trio, timeline, sections), New lead wizard (stepper + sticky footer), Lead created (success), Cards (featured card art, category chips, rich list), Card detail (large card art, benefit list, fees, sourcing check, sticky CTA), Earnings (balance hero, bucket tiles, selectable entitlements, sticky request bar), Payout request detail, Pending follow-ups, Profile/More (profile header, grouped settings rows, sign out), Notifications.
- **Manager:** Team home (hero metrics, team list with avatars), Advisors, Advisor drill-down, Lead (read-only), Telecaller detail, Approvals, Create Telecaller, Payout request, Profile, Notifications.
- **Telecaller:** Queue (due-now hero, segmented tabs, record cards with call action), Record/call desk, Card share, ID card (premium ID), Profile, Notifications.

## 4. Non-goals / must not change
- API calls, payloads, routing (`lib/routing.ts`), gates, secure-route policy (`lib/secure-routes.ts`), validation masks and business copy that carries compliance meaning (e.g. "Status values are exactly what the bank reported", "Indicative only — the bank decides every application").
- Tests in `apps/mobile/lib/*.test.ts` stay green.

## Acceptance criteria
- [x] Design system components exist and every screen uses them; no emoji used as an icon.
- [x] Safe areas respected on every screen (D1); Manager list bug fixed (D2); every tab has an icon and label (D3); status bar is dark-on-light / light-on-navy (D4); consistent `AppBar` back navigation (D5); skeletons or spinners on first load (D6).
- [x] Bank status still shown as three labelled chips with provenance; no bank-value semantics changed.
- [x] `pnpm --filter mobile typecheck`, `lint`, `test` pass.
- [x] Screens rendered and visually checked at 390×844.

## Progress notes
- Session 12 (done). Commits: `docs(F-805): start` → `chore(mobile)` Ionicons + Inter (JS/asset packages; `expo-font` is already linked by `expo`, so **no native rebuild**) → `feat(mobile)` design system (`lib/theme.ts`, `components/ui`, `components/brand/credit-card-art.tsx`, `components/tab-bar.tsx`, restyled status chips + `StatusTrio`, `LeadRow`, root font loading) → Advisor home + tab bar → auth/gates → Advisor screens → Manager/Telecaller screens.
- Design-system guide for future screens: `apps/mobile/components/ui/README.md` (rules + component list). Role-local helpers: `components/auth`, `components/advisor/parts.tsx`, `components/team` (metric tiles with source labels, profile view, QR drawn from the `/id-cards/me` SVG with Views — `react-native-svg` is not installed).
- Tailwind: weight utilities select Inter faces (`corePlugins.fontWeight` off + plugin); `darkMode: 'class'` (the app is light-only — with `media`, a dark system theme broke NativeWind on web and could half-apply).
- Gradients/shadows use RN's built-in `experimental_backgroundImage` / `boxShadow` (new architecture), so they need no module; verify on the physical Android device together with the F-302 SEC-02 run.
- Defects fixed: D1 safe areas (`Screen`/`HeroHeader`/`StickyFooter`/`BottomSheet` use insets), D2 Manager team rows used `onTouchEnd` and the list sat under the summary (now `onPress` + one virtualised `FlatList` with the dashboard as header), D3 icons on every tab, D4 status bar set per screen (`Screen statusBar`), D5 `AppBar` back everywhere (tabs use `backBehavior="history"`), D6 skeletons/empty/error states.
- Deliberate UX changes (presentation, not data): Advisor tab bar is Home / Leads / **New lead** (centre action → catalogue) / Cards / Earnings; profile opens from the home avatar. Leads filters live in a bottom sheet and apply on **Apply** (closing the sheet discards unapplied choices); quick chips above the list set the same `actionable` / `misFreshness` fields. Lead detail is split into Overview / Bank data / Activity tabs (all sections kept). Payout confirmation opens as a bottom sheet (same submit + idempotency key). Telecaller `id-card` is now a visible tab (still in `PROTECTED_ROUTES`). Manager profile gained a Create Telecaller shortcut.
- Behaviour review (separate reviewer pass over the whole diff): every endpoint/payload/mask/route/testID preserved; follow-ups applied — no invented approval total on Manager approvals, payout amounts keep paise, stale error cleared after retry in `PayoutRequestDetail`, neutral notification empty text, Manager advisor tiles show ₹0 when the amount is absent.
- Verification: `pnpm --filter mobile typecheck`, `lint`, `test` (11) green. Every screen rendered with Expo web at 390×844 against a local API seeded by `apps/api/scripts/demo-seed.mjs` (web preview needs `react-native-web`, `react-dom`, `@expo/metro-runtime` and a web shim for `expo-secure-store` — kept out of the repo on purpose). Not verified: native Android rendering (gradients, shadows, fonts), live-call states, onboarding with a real in-progress advisor.
- Known, not changed: shared `statusTone` maps decision `DECLINE` only, so a bank value like "Declined" renders neutral (same on web) — candidate for a shared-vocabulary review, not a UI change.
