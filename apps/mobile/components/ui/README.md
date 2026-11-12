# Mobile design system (F-805, restyled by F-820)

F-820 (session 26) replaced the F-818 glass look. Canvas is a flat neutral `#F4F3F1`; cards are white with **no border and no shadow**; grouping inside a card uses the `raised` fill (`#F1EFEC`), hairlines (`#ECE9E5`) only between list rows. Ink `#16130F`. KBS orange `#C2410C` is the only accent and the only primary-action colour. Typeface is Manrope. No blur, gradients or ambient light anywhere except `CreditCardArt`. Each role home has one dark `HeroCard` carrying the figure that matters.

## Rules

1. **Never use emoji as an icon.** Use `Icon` / `IconCircle` / `IconButton` (Ionicons names, outline for idle, filled for active/emphasis).
2. **Every screen starts with `Screen`.** It handles safe areas and the status-bar style.
   - Detail / form screens: `<Screen scroll header={<AppBar title="…" subtitle="…" />} footer={<StickyFooter>…</StickyFooter>}>`.
   - Home-style screens: `<Screen inset="none" scroll padded={false}>` + `<HeroHeader>` (the page title on the canvas) first, then a `<View className="mt-4 gap-5 px-4">`. Titles name the screen or period — no greetings.
   - List screens: `<Screen header={…}>` + `FlatList` with `contentContainerClassName="gap-3 px-4 pb-10"`, `refreshControl`, `ListHeaderComponent`, `ListEmptyComponent={<EmptyState …/>}`, and `SkeletonList` before the first load.
   - Never put "← Back" buttons in content: `AppBar` has the back button (it calls `router.back()`; tabs use `backBehavior="history"`).
3. **Every state designed:** first load → `Skeleton` / `SkeletonList`; empty → `EmptyState` (icon, title, one-line guidance, optional action); error → `ErrorState` (with retry) for full-screen failures or `ErrorText` for inline form errors.
4. **Hierarchy:** from size and colour, not weight — `font-normal` (Manrope 500) for text and `font-medium` (600) for labels and titles; `font-semibold` (700) for rare emphasis. One type scale (tailwind `fontSize`): `text-xs` 12 · `sm` 13 · `md` 14 · `base` 16 · `lg` 18 · `xl` 24 · `2xl` 30 · `3xl` 38 — no `text-[NNpx]`. Sentence case, no uppercase/tracking; numbers `tabular-nums`. `Muted` for meta; `Overline` is a quiet sentence-case label. Use `SectionHeader` above grouped cards; `ListItem` rows inside a `Card className="px-4 py-1"` for settings/detail lists; `KeyValue` rows for label/value facts.
5. **Bank truth stays distinct (INV-01…03):** show Stage / Decision / Activation with `StatusTrio` or the three `StageBadge`/`DecisionBadge`/`ActivationBadge`; keep `ProvenanceChip`s; never merge them into one success/failure chip and never change the text the bank reported. Keep all compliance copy (e.g. "Indicative only — the bank decides every application").
6. **Motion:** one easing (`EASE`, cubic-bezier(0.22, 1, 0.36, 1)), short durations. `Appear index={i}` is the only entrance (fade-up, stagger capped at 6). No looping, pulsing or springy motion unless it shows live status; skeletons are static.
7. **Touch targets ≥ 44pt**, labels always visible, `accessibilityLabel` on icon-only buttons.
8. **Surfaces:** `Glass` / `GlassScope` / `Card variant="glass"` keep their names but are plain white surfaces (no blur, no ambient light, no outline). No hue gradients, glows or coloured shadows anywhere except `CreditCardArt`. Radius: controls 14 (`rounded-lg`), cards 18–22 (`rounded-xl`/`2xl`), hero cards and sheets 28 (`rounded-3xl`); `rounded-full` only for avatars, dots, toggles, chips and progress tracks.
9. Use classes, not inline colours, where a token exists: `bg-canvas`, `bg-navy`, `text-ink`, `text-brand`, `bg-gold`, `border-line`. JS colours for icons: `colors` from `@/lib/theme`. `gradientStyle` is for card art only; shadows: `shadow.sm|md|lg` (neutral). Icons: Ionicons at 16–20 (24 in the tab bar), coloured by their text role; no icons that only decorate a title or stat tile.
   9a. **No `className` on Reanimated components** (`Animated.View`, `createAnimatedComponent`) — on Android NativeWind does not apply it (web does, so previews hide the bug). Put classes on a plain `View` inside/outside the animated one, or use inline styles.
10. Weight classes (`font-medium|semibold|bold|extrabold`) switch the Manrope face (each class is one step heavier than its name) — don't use `fontWeight` in styles.
11. Tailwind opacity steps are 5/10/15/20/25/…; use `bg-white/[0.07]` style for others.

## Components (`@/components/ui`)

Typography: `Text`, `Heading`, `Display`, `Muted`, `Overline`, `Label`, `ErrorText`.
Surfaces: `Glass`, `GlassScope`, `Icon`, `Gradient`, `PressableScale`, `Appear`, `Card` (`variant` elevated|outline|tinted|flat, optional `onPress`), `Badge` (`variant` default|secondary|success|warning|destructive|info|unknown, `dot`, `icon`, `solid`, `size`), `Chip`, `Segmented`, `Avatar`, `IconCircle`, `ProgressBar`, `Divider`, `Skeleton`, `SkeletonList`, `KeyValue`, `Callout` (info|warning|danger|success|neutral), `SectionHeader`, `ListItem`, `EmptyState`, `ErrorState`, `StatTile`, `Stepper`, `ChoiceRow`.
Actions: `Button` (`variant` default(graphite)|gold(accent)|secondary|outline|destructive|ghost|light, `size` sm|md|lg, `icon`, `iconRight`, `loading`), `IconButton` (`tone` plain|light|soft, `badge`).
Inputs: `Input` (`label`, `icon`, `prefix`, `error`, `hint`, `right`, `multiline`).
Layout: `Screen`, `AppBar` (`title`, `subtitle`, `right`, `light`, `large`, `back`), `HeroHeader`, `StickyFooter`, `BottomSheet` (`open`, `onClose`, `title`, `footer`).
Domain: `CreditCardArt` (`@/components/brand/credit-card-art`), `StatusTrio` / badges / `ProvenanceChip` / `PayoutStateBadge` (`@/components/status`), `LeadRow`, `TabBar` (`@/components/tab-bar`).

## Headers and copy (session 25 pass)
- **One compact header row everywhere.** Screens with a back arrow: the title sits beside the arrow (`AppBar`, `AuthShell`), never on a row of its own under it. Top-level tabs: `AppBar back={false} large` (or the same shape by hand) — title at `text-xl`, a count or meta on the right, no second line.
- **A subtitle must carry data** (a count, a reference, a status). Never one that restates the screen ("Call desk", "Review the evidence before you decide").
- **Say a thing once per screen.** Keep the short provenance tags REQ-20 asks for (`Bank MIS`, `KBS activity`, "as of …"); do not repeat the explanation in a callout, a section subtitle and a footnote. One reference per card — the lead reference is not shown in the header and again in the body.
- **No developer wording in the UI.** `Activation: V + ACTIVE`, not `cardActivationStatus = "V + ACTIVE"`.
- **A step's name appears once** (its card heading); the stepper shows only "Step n of m".
- Screenshot tour for review: build with `EXPO_PUBLIC_QA_ALLOW_CAPTURE=1` and force a fresh bundle (`./gradlew :app:cleanCreateBundleReleaseJsAndAssets assembleRelease …`) — Gradle does not re-bundle for an env-only change. Never ship that build.
