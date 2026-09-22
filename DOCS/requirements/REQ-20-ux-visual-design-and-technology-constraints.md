<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 20. UX, visual design and technology constraints

## 20.1 shadcn/ui requirement and platform reality

The web UI MUST use **shadcn/ui** components and a consistent design
system; **Tamagui and any substitute full UI framework must not be
used**. shadcn/ui's web component implementations are web/DOM oriented
and cannot simply be imported as native Android controls. Build an
**aligned React Native component set following the same shadcn visual
tokens/interaction principles** (for example, a carefully vetted React
Native shadcn-style component registry or in-house native components).
This is a platform-compatible implementation of the user's design
requirement, **not** a license to add an unrelated full UI framework.
Shared tokens: spacing, typography, semantic colors, component shape,
iconography, field/error states and interaction semantics.

## 20.2 Product-level visual outcomes

Provide a polished, intuitive and consistent experience on Android and
web with clear hierarchy, touch-friendly layouts, accessible contrast,
readable numbers and restrained high-quality animations. Make primary
tasks available immediately from each role's home; use progressive
disclosure for large MIS data sets. Application stage, final decision,
activation and payout state must each have visually distinct labels and
explicit text, never color alone. Customers' sensitive fields are masked
by default as appropriate. No screenshot/download control should
undermine defined Telecaller privacy policy.

## 20.3 Required components and responsive behaviour

> **• Web:** shadcn navigation/sidebar, cards, dialogs, command/search,
> accessible data tables, upload review steps, status badges, filters,
> date-range controls, drill-down detail views, documents/recording
> viewer and notification drawer.
>
> **• Mobile:** native bottom/tab/stack navigation, compact lead cards,
> expandable bank detail, robust OTP, multi-step form with persistent
> selected card, persistent calling controls, full-width WhatsApp
> actions, readable payout ledger and adaptive empty/error/loading
> states.
>
> **• Shared UX patterns:** explicit provenance chips (Bank MIS, KBS
> activity, Accounts payment); distinguish 'Awaiting MIS Update' from
> actual reported Inprocess; require confirmation for sensitive
> irreversible actions; display upload freshness and last matched
> status; provide safe retry without duplicate side effects.

## 20.4 User-centred role specifics

Telecaller screen maximizes call context and card/share actions; Advisor
minimizes effort in customer lead creation and clearly separates link
initiation from actual bank results; Manager prioritizes team
drill-down; Admin prioritizes data integrity and reports; Accounts
prioritizes dual-approval audit, itemized payment and proof. If a bank
column has no meaningful value, use 'Not reported' rather than an
unlabeled dash. Never hide a conflicting MIS row behind a green
aggregate KPI.

## 20.5 Accessibility and localization

English only in initial release. Ensure readable text scaling,
accessible labels/keyboard/focus on web, sufficient contrast, clear
field-error descriptions and large touch targets. Some protected-screen
controls may interact with accessibility services; evaluate security
without silently blocking assistive technologies. India-oriented
formatting (INR, local phone/date conventions) should be consistent
while preserving raw source timestamps/time zones.
