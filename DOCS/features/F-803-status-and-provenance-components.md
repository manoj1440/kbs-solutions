# F-803 Shared status/provenance component set (web + mobile)

- Group: UX shells · Status: **IN_PROGRESS** · Depends on: F-006, F-004
- PRD refs: REQ-20 §20.2 (distinct labels for stage/decision/activation/payout; explicit text; never colour alone), §20.3 (provenance chips; 'Awaiting MIS Update' vs reported Inprocess), REQ-14 §14.3
- QA ids: VIEW-01

## Detailed requirements
Web (`apps/web/components/status/*`) and mobile (`apps/mobile/components/status/*`) implementations of `StageBadge`, `DecisionBadge`, `ActivationBadge`, `PayoutStateBadge`, `ProvenanceChip` (`Bank MIS · as of <date>`, `KBS activity`, `Accounts payment`), `FreshnessLabel` (`Last matched MIS: <date>` / `Never matched`). Props take `StatusField` from `@kbs/shared`; text always rendered; icons per intent; tokens from `@kbs/ui-tokens`. Storybook-free: a `/dev/components` route on web and a dev screen on mobile render all variants for visual QA.

## Acceptance criteria
- [ ] Rendering `{display:'Not reported'}` and `{display:'Awaiting MIS Update'}` produce different text and neutral tones.

## Progress notes
- 2026-09-22 (session 1): Web + mobile Stage/Decision/Activation/Payout badges, ProvenanceChip, FreshnessLabel. Pending: dev gallery routes and snapshot tests.
