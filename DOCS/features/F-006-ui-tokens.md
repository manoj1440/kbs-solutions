# F-006 `@kbs/ui-tokens` design tokens

- Group: Foundation · Status: **PLANNED** · Depends on: F-001 · ADR-003
- PRD refs: REQ-20 §20.1 (shared tokens: spacing, typography, semantic colours, shape, iconography, field/error states), §20.2 (labels never colour-only), §20.5 (contrast, text scaling)

## Scope
- `tokens.ts`: colour scales (neutral, primary, success, warning, danger, info) as OKLCH/HSL, **semantic roles**: `provenance.bankMis`, `provenance.kbsOperational`, `provenance.kbsPayment`; status intents: `stage`, `decision`, `activation`, `payout` each with `unknown` variant; spacing 4-pt scale; radius; typography scale; z-index.
- `css.ts` → generates `:root` / `.dark` CSS variables in shadcn naming (`--background`, `--primary`, …) plus our semantic extras.
- `nativewind.ts` → theme object for NativeWind `tailwind.config`.
- Contrast check test (WCAG AA for text on each semantic background).

## Acceptance criteria
- [ ] Web tailwind config and mobile tailwind config both import from this package.
- [ ] All semantic text/background pairs pass 4.5:1 in the test.
