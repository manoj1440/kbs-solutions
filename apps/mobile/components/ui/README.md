# Mobile design system (F-805)

Premium fintech, light-first. Navy → indigo gradient heroes, white elevated surfaces on a soft `canvas` (#F4F6FB), gold for money moments, Inter type, Ionicons, subtle motion. Reference screen: `app/(advisor)/index.tsx`.

## Rules
1. **Never use emoji as an icon.** Use `Icon` / `IconCircle` / `IconButton` (Ionicons names, outline for idle, filled for active/emphasis).
2. **Every screen starts with `Screen`.** It handles safe areas and the status-bar style.
   - Detail / form screens: `<Screen scroll header={<AppBar title="…" subtitle="…" />} footer={<StickyFooter>…</StickyFooter>}>`.
   - Home-style screens: `<Screen inset="none" statusBar="light" scroll padded={false}>` + `<HeroHeader>` first, then a `<View className="-mt-12 gap-5 px-4">` for content that overlaps the hero.
   - List screens: `<Screen header={…}>` + `FlatList` with `contentContainerClassName="gap-3 px-4 pb-10"`, `refreshControl`, `ListHeaderComponent`, `ListEmptyComponent={<EmptyState …/>}`, and `SkeletonList` before the first load.
   - Never put "← Back" buttons in content: `AppBar` has the back button (it calls `router.back()`; tabs use `backBehavior="history"`).
3. **Every state designed:** first load → `Skeleton` / `SkeletonList`; empty → `EmptyState` (icon, title, one-line guidance, optional action); error → `ErrorState` (with retry) for full-screen failures or `ErrorText` for inline form errors.
4. **Hierarchy:** one `Heading`/large number per section; `Muted` for meta; `Overline` for small caps labels; numbers in `font-extrabold`. Use `SectionHeader` above grouped cards; `ListItem` rows inside a `Card className="px-4 py-1"` for settings/detail lists; `KeyValue` rows for label/value facts.
5. **Bank truth stays distinct (INV-01…03):** show Stage / Decision / Activation with `StatusTrio` or the three `StageBadge`/`DecisionBadge`/`ActivationBadge`; keep `ProvenanceChip`s; never merge them into one success/failure chip and never change the text the bank reported. Keep all compliance copy (e.g. "Indicative only — the bank decides every application").
6. **Motion:** wrap top-level sections/list items in `Appear index={i}` (staggered fade-up, capped). Buttons/cards already have spring press feedback (`PressableScale`). Don't over-animate.
7. **Touch targets ≥ 44pt**, labels always visible, `accessibilityLabel` on icon-only buttons.
8. Use classes, not inline colours, where a token exists: `bg-canvas`, `bg-navy`, `text-ink`, `text-brand`, `bg-gold`, `border-line`. JS colours for icons: `colors` from `@/lib/theme`. Gradients: `gradientStyle(stops, angle)` / `gradients.*`; shadows: `shadow.sm|md|lg|glow|gold`.
9. Weight classes (`font-medium|semibold|bold|extrabold`) switch the Inter face — don't use `fontWeight` in styles.
10. Tailwind opacity steps are 5/10/15/20/25/…; use `bg-white/[0.07]` style for others.

## Components (`@/components/ui`)
Typography: `Text`, `Heading`, `Display`, `Muted`, `Overline`, `Label`, `ErrorText`.
Surfaces: `Icon`, `Gradient`, `PressableScale`, `Appear`, `Card` (`variant` elevated|outline|tinted|flat, optional `onPress`), `Badge` (`variant` default|secondary|success|warning|destructive|info|unknown, `dot`, `icon`, `solid`, `size`), `Chip`, `Segmented`, `Avatar`, `IconCircle`, `ProgressBar`, `Divider`, `Skeleton`, `SkeletonList`, `KeyValue`, `Callout` (info|warning|danger|success|neutral), `SectionHeader`, `ListItem`, `EmptyState`, `ErrorState`, `StatTile`, `Stepper`, `ChoiceRow`.
Actions: `Button` (`variant` default(gradient)|gold|secondary|outline|destructive|ghost|light, `size` sm|md|lg, `icon`, `iconRight`, `loading`), `IconButton` (`tone` plain|light|soft, `badge`).
Inputs: `Input` (`label`, `icon`, `prefix`, `error`, `hint`, `right`, `multiline`).
Layout: `Screen`, `AppBar` (`title`, `subtitle`, `right`, `light`, `large`, `back`), `HeroHeader`, `StickyFooter`, `BottomSheet` (`open`, `onClose`, `title`, `footer`).
Domain: `CreditCardArt` (`@/components/brand/credit-card-art`), `StatusTrio` / badges / `ProvenanceChip` / `PayoutStateBadge` (`@/components/status`), `LeadRow`, `TabBar` (`@/components/tab-bar`).
