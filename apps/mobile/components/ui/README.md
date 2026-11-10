# Mobile design system (F-805)

Unslop pass on top of F-818 (gradients, bold weights, uppercase labels and one-off sizes removed). Kept from F-818 by request: the cream canvas (#F2EEE8, card #FFFDFA, raised #F7F4EF, hairline #E7E1D8), the ambient orange / teal light in `GlassScope` and the frosted `Glass` (expo-blur) on the tab bar, sheets and KPI tiles. Three text roles: ink #1C1917, secondary #4A433E, muted #6A625D. KBS orange is the only accent and is used rarely — the primary money action, the selection, one key figure per screen; fills and accent text use #C2410C (`gold`, passes 4.5:1 with white), the bright #F05A28 (`orange`) is for small marks only. The rendered `CreditCardArt` is the one material moment (it keeps its gradient). Signature: the provenance dot + quiet label (`ProvenanceChip`, `SourceTag`). Inter, Ionicons. Reference screen: `app/(advisor)/index.tsx`.

## Rules

1. **Never use emoji as an icon.** Use `Icon` / `IconCircle` / `IconButton` (Ionicons names, outline for idle, filled for active/emphasis).
2. **Every screen starts with `Screen`.** It handles safe areas and the status-bar style.
   - Detail / form screens: `<Screen scroll header={<AppBar title="…" subtitle="…" />} footer={<StickyFooter>…</StickyFooter>}>`.
   - Home-style screens: `<Screen inset="none" scroll padded={false}>` + `<HeroHeader>` (the page title on the canvas, hairline below) first, then a `<View className="mt-4 gap-5 px-4">`. Titles name the screen or period — no greetings.
   - List screens: `<Screen header={…}>` + `FlatList` with `contentContainerClassName="gap-3 px-4 pb-10"`, `refreshControl`, `ListHeaderComponent`, `ListEmptyComponent={<EmptyState …/>}`, and `SkeletonList` before the first load.
   - Never put "← Back" buttons in content: `AppBar` has the back button (it calls `router.back()`; tabs use `backBehavior="history"`).
3. **Every state designed:** first load → `Skeleton` / `SkeletonList`; empty → `EmptyState` (icon, title, one-line guidance, optional action); error → `ErrorState` (with retry) for full-screen failures or `ErrorText` for inline form errors.
4. **Hierarchy:** from size and colour, not weight — weights 400/500 (`font-normal`/`font-medium`), 600 at most for rare emphasis, never bold/extrabold. One type scale (tailwind `fontSize`): `text-xs` 12 · `sm` 13 · `md` 14 · `base` 15 · `lg` 17 · `xl` 22 · `2xl` 28 · `3xl` 32 — no `text-[NNpx]`. Sentence case, no uppercase/tracking; numbers `tabular-nums`. `Muted` for meta; `Overline` is a quiet sentence-case label. Use `SectionHeader` above grouped cards; `ListItem` rows inside a `Card className="px-4 py-1"` for settings/detail lists; `KeyValue` rows for label/value facts.
5. **Bank truth stays distinct (INV-01…03):** show Stage / Decision / Activation with `StatusTrio` or the three `StageBadge`/`DecisionBadge`/`ActivationBadge`; keep `ProvenanceChip`s; never merge them into one success/failure chip and never change the text the bank reported. Keep all compliance copy (e.g. "Indicative only — the bank decides every application").
6. **Motion:** one easing (`EASE`, cubic-bezier(0.22, 1, 0.36, 1)), short durations. `Appear index={i}` is the only entrance (fade-up, stagger capped at 6). No looping, pulsing or springy motion unless it shows live status; skeletons are static.
7. **Touch targets ≥ 44pt**, labels always visible, `accessibilityLabel` on icon-only buttons.
8. **Surfaces:** `Glass` / `GlassScope` / `Card variant="glass"` keep their names but are plain raised surfaces with a hairline now (no blur, no ambient light). No hue gradients, glows or coloured shadows anywhere except `CreditCardArt`. Radius: controls 8–10 (`rounded-lg`), cards 12–16 (`rounded-xl`/`2xl`), sheets 20 (`rounded-3xl`); `rounded-full` only for avatars, dots, toggles, chips and progress tracks.
9. Use classes, not inline colours, where a token exists: `bg-canvas`, `bg-navy`, `text-ink`, `text-brand`, `bg-gold`, `border-line`. JS colours for icons: `colors` from `@/lib/theme`. `gradientStyle` is for card art only; shadows: `shadow.sm|md|lg` (neutral). Icons: Ionicons at 16 or 18, coloured by their text role; no icons that only decorate a title or stat tile.
   9a. **No `className` on Reanimated components** (`Animated.View`, `createAnimatedComponent`) — on Android NativeWind does not apply it (web does, so previews hide the bug). Put classes on a plain `View` inside/outside the animated one, or use inline styles.
10. Weight classes (`font-medium|semibold|bold|extrabold`) switch the Inter face — don't use `fontWeight` in styles.
11. Tailwind opacity steps are 5/10/15/20/25/…; use `bg-white/[0.07]` style for others.

## Components (`@/components/ui`)

Typography: `Text`, `Heading`, `Display`, `Muted`, `Overline`, `Label`, `ErrorText`.
Surfaces: `Glass`, `GlassScope`, `Icon`, `Gradient`, `PressableScale`, `Appear`, `Card` (`variant` elevated|outline|tinted|flat, optional `onPress`), `Badge` (`variant` default|secondary|success|warning|destructive|info|unknown, `dot`, `icon`, `solid`, `size`), `Chip`, `Segmented`, `Avatar`, `IconCircle`, `ProgressBar`, `Divider`, `Skeleton`, `SkeletonList`, `KeyValue`, `Callout` (info|warning|danger|success|neutral), `SectionHeader`, `ListItem`, `EmptyState`, `ErrorState`, `StatTile`, `Stepper`, `ChoiceRow`.
Actions: `Button` (`variant` default(graphite)|gold(accent)|secondary|outline|destructive|ghost|light, `size` sm|md|lg, `icon`, `iconRight`, `loading`), `IconButton` (`tone` plain|light|soft, `badge`).
Inputs: `Input` (`label`, `icon`, `prefix`, `error`, `hint`, `right`, `multiline`).
Layout: `Screen`, `AppBar` (`title`, `subtitle`, `right`, `light`, `large`, `back`), `HeroHeader`, `StickyFooter`, `BottomSheet` (`open`, `onClose`, `title`, `footer`).
Domain: `CreditCardArt` (`@/components/brand/credit-card-art`), `StatusTrio` / badges / `ProvenanceChip` / `PayoutStateBadge` (`@/components/status`), `LeadRow`, `TabBar` (`@/components/tab-bar`).
