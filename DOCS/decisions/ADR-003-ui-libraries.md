# ADR-003: UI: shadcn/ui on web, react-native-reusables on mobile, shared tokens

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-20 §20.1–20.3, REQ-30 §30.2

## Context
The PRD mandates shadcn/ui and forbids Tamagui or any substitute full UI framework. shadcn components are DOM-based; the PRD explicitly allows a "React Native shadcn-style component registry or in-house native components".

## Decision
Web: Next.js 16 App Router + Tailwind v4 + shadcn/ui components copied into `apps/web/components/ui`. Mobile: NativeWind + **react-native-reusables** (the shadcn-style RN registry the PRD itself cites) copied into `apps/mobile/components/ui`, with in-house components where the registry lacks one. Both read `@kbs/ui-tokens` (CSS variables for web, JS object + NativeWind theme for mobile) so spacing, radius, semantic colours and typography are identical.

## Consequences
No runtime UI framework dependency beyond Tailwind/NativeWind primitives. Components are owned code (shadcn model), so we can guarantee the provenance-chip and status-badge patterns are consistent. Icons: `lucide-react` / `lucide-react-native`.

## Alternatives
Tamagui (forbidden), React Native Paper / gluestack (would be a "substitute full UI framework").
