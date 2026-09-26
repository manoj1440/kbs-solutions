# F-806 Web Admin UI revamp — rich design system and every Admin page

- Group: UX shells · Status: **DONE** · Depends on: F-801, F-803, F-804
- PRD refs: REQ-20 (shared tokens §20.1, text never colour-only §20.2, adaptive states §20.3, accessibility §20.5), REQ-25 §25.4 (Admin screen inventory)
- Origin: user request (2026-09-26) — "improve the visual appearance of the admin web app … very rich, impressive, intuitive and engaging. Deep analysis first, then a solid plan, then implement."

## 1. Audit of the current Admin web UI (before)

Rendered all 38 Admin routes at 1440 px against the demo seed (`apps/web/test/admin-shots.mjs`) and read every file under `apps/web/src/app/(admin)`, `src/components`, `src/components/ui`.

Two pages had already been designed (session 6): the shell (navy sidebar, Cmd+K search) and **Business overview**. Everything else is stock shadcn: a `text-2xl` title, a paragraph, then white cards containing plain tables. The product therefore looks like two different apps.

### Defects (real bugs, not taste)
| # | Where | Problem |
|---|---|---|
| D1 | `ui/table` cells + badges | `overflow-wrap:anywhere` lets the table auto-layout squeeze columns below word width → words break mid-letter: "APPROV/ED", "DELT/A", "Batch/es", "Stag/e:" (MIS profiles, recent-leads stage label). |
| D2 | KBS enums in the UI | Raw constants shown to people: `APPROVED`, `DELTA`, `PUBLISHED v1`, `PENDING_ONBOARDING`, `TELECALLER`, lowercase queue chips `payment recorded pending proof`. (Bank values are *not* enums — they stay verbatim, INV-01.) |
| D3 | Solid badges | Every badge is a saturated filled block; three per lead row plus provenance read as buttons ("Not reported" dark grey pills look clickable). |
| D4 | Native `<select>` | Browser-default chevrons and heights, differing from the 40 px inputs next to them. |
| D5 | Links | Table links are black-underlined (`underline`) on some pages, teal on others. |
| D6 | Disabled primary buttons | Pale teal full-width blocks ("Create draft card", "Add follow-up task") look like broken banners. |
| D7 | Empty states | "No uploads yet." as a grey table row; no guidance or action. |

### UX / visual problems
- **No page identity.** 36 pages share the same bare heading; no icon, no context, no key numbers above the fold.
- **Numbers are not emphasised.** KPIs on dashboards are 18 identical boxes with the source line competing with the value.
- **Catalogue is a table** though it is the product's storefront; banks are a 10-row table of "active" buttons.
- **Configuration** is a 6 000 px wall of 20 tables with no navigation.
- **Payout queues** are 10 lowercase chips wrapping to two lines.
- **Filters** are always-open forms taking a third of the screen (Leads, Dashboards).
- **Detail pages** (lead, user, batch, rule) have no summary header; the most important facts are in the middle.
- **No motion or depth**: flat hairline cards, no hover lift, no entrance.

## 2. Design direction (after)

Keep the established KBS brand (navy `#0B1A2E` sidebar, teal primary) and make it **rich, calm and data-first** — "premium operations console":
- Soft-grey canvas with a faint top gradient; white surfaces with layered soft shadows and 16 px radius; subtle hover lift on interactive cards.
- **Page hero** on every page: icon tile + eyebrow (section group) + title + one-line purpose + primary actions, optional KPI strip under it.
- **Soft tinted badges** (tone background at ~12 %, tone text, inset ring) — same text, same tone mapping (REQ-20 §20.2 unchanged).
- Typography: Inter (system fallback), tabular numerals for all figures, 28–34 px page titles, 26–32 px KPI values.
- Colour-coded entity marks: deterministic bank monograms, role colours for people, credit-card art for catalogue cards.
- Motion: 200 ms fade/slide-in for page content, hover lift, active-nav indicator; all disabled by `prefers-reduced-motion`.

### Principles
1. **Presentation only.** No API, payload, route, permission, validation or copy-with-compliance-meaning changes. Bank values stay verbatim; Stage / Decision / Activation stay three separate labelled badges with provenance (INV-01…03).
2. **Humanise KBS enums only** (`humanize()`), never bank MIS values.
3. **One glance = one answer.** Each page leads with what matters (counts, state, next action).
4. **Every state designed**: empty (icon + next step), error (existing alerts restyled), disabled buttons that look disabled but not broken.
5. **No new dependencies** (ADR-003: shadcn/ui + Tailwind + lucide only). Charts stay CSS/SVG.
6. e2e selectors preserved (`h1` per page, button names, dialog labels, `Digit n` labels).

## 3. Plan

### Phase A — foundation (`src/components/ui`, `globals.css`)
- Tokens: admin elevation shadows, canvas gradient, brand colours in `@theme` (`navy`, `brand`), focus ring.
- Primitives upgraded in place: `Button` (rounded-lg, depth, `soft` variant), `Badge` (soft tones; keeps `bg-<tone>` class), `Card` (radius, shadow, `CardHeader` actions), `Input`, new `Select` (styled native select — no Radix), `Table` (header style, row hover, **D1 fix**), `Skeleton`.
- New kit `src/components/ui/kit.tsx`: `PageHeader`, `StatCard`, `StatGrid`, `SectionCard`, `EmptyState`, `PillNav`, `Avatar`, `BankMark`, `Meter`, `KeyValueGrid`, `Callout`, `humanize()`.
- Domain: `CreditCardArt` (web), restyled status badges and provenance chip.
- Guide: `src/components/ui/README.md` (rules + component list) for future pages.

### Phase B — shell
- Sidebar: gradient navy, brand mark, section labels, active indicator bar + glow, compact footer with user card and sign-out.
- Top bar: group › page breadcrumb, command palette (keyboard ↑/↓/Enter, grouped results), notification + refresh, avatar menu.
- Content: fade-in on navigation, max width 1600.

### Phase C — pages (all 38 Admin routes)
| Area | Pages | Treatment |
|---|---|---|
| Workspace | overview, leads (+detail), onboarding (+detail), users (+detail), notifications, account | hero headers, collapsible advanced filters, lead summary hero, avatars/role chips |
| Sales ops | calling lists (+wizard), distribution (+telecaller), oversight, catalogue (+editor), pincode profiles (+editor), training (+module, team) | card-art catalogue grid, bank tiles, module cards with progress |
| Dashboards | executive, telecallers, managers, advisors, bank/card mix, audit | pill tab nav, KPI tiles with icon + source, meters |
| Bank data & finance | MIS (+batch, profile), integrity, liability, requests (+detail), entitlements, rules (+detail) | KPI strips, stage pipeline stepper, queue pill nav with humanised labels, amount emphasis |
| Administration | compliance, network, config, retention | config section index + launch-gate meter |

Shared components used by Admin *and* Manager/Accounts (leads browser, payout lists, team ops) get the same primitives, so those areas improve too; their `AppShell` is out of scope.

### Phase D — verification
- `pnpm --filter web typecheck lint test`; production build.
- Screenshot sweep of every Admin route at 1440 and 390 (no page overflow, no framework error), visual review against this audit.

## Acceptance criteria
- [x] D1–D7 fixed.
- [x] Every Admin page uses `PageHeader` and the kit; no raw KBS enum constants shown; no underlined black table links.
- [x] Bank status still three separate labelled badges with provenance; bank values verbatim; unit test VIEW-01 green.
- [x] No new dependencies; reduced-motion respected; focus visible.
- [x] typecheck, lint, unit tests, build pass; all Admin routes render at 1440 and 390 with no page overflow.

## Progress notes
- Session 13: audit + plan written, then built. Commits: `docs(F-806): start` → design system (soft badges, primitives, `ui/kit.tsx`, `card-art.tsx`, D1 table word-break fix, global select chevron, canvas + entrance motion) → shell (gradient sidebar with active indicator, group › page breadcrumb, command palette with ↑/↓/Enter, account menu) → MIS reference page → one commit per area (calling, people, overview + leads, dashboards + audit, MIS detail + integrity, admin settings, payouts, catalogue + coverage + training).
- Guide for future pages: `apps/web/src/components/ui/README.md`. Reference page: `app/(admin)/admin/mis/page.tsx`.
- Page work was split across parallel helpers by disjoint file groups; every group was checked for behavioural drift (API paths, hrefs, form `name`/`id`/`htmlFor` compared to HEAD) before committing — only new navigation links, label associations and PillNav items (same hrefs) differ.
- Shared components (leads browser/table/detail, payout list/detail/dashboard, entitlements ledger, team ops, operations dashboard, notification centre, account page, training table, calling distribution) take optional `eyebrow`/`icon` props, so Manager and Accounts pages get the new look inside their existing `AppShell` (the shell itself was not redesigned — candidate follow-up).
- Deliberate presentation changes: Leads/Executive filters keep one GET form but move less-used fields into a native "More filters" `<details>` (opens automatically when one is set) plus removable active-filter chips; catalogue is a card-art grid; onboarding queue is review cards sorted longest-waiting first; configuration has a section index and value pills; payout requests show a Manager → Admin stepper; lead detail has a hero with the three bank badges as separate tiles. Two new explanatory lines: "Illustration only — not the bank's card artwork." and "Try clearing a filter or widening the date range."
- Bugs fixed on the way (render-time fetches — React rejected the state update and the first load could be lost): calling-list review queue, MIS batch rows, MIS quarantine, new payout rule known values now load in effects. Sidebar highlighted "Executive dashboard" on the managers/advisors dashboards (now "Team performance").
- Verification (Mac, dev servers on :3200/:4200, demo data): web typecheck + lint (existing TanStack warning only) + unit 11/11; `next build` passes; screenshot sweep `node apps/web/test/admin-shots.mjs <dir> 1440|390` → 39 Admin routes, overflow 0, no errors, reviewed visually; Playwright `admin-smoke` 30/30 desktop + 30/30 phone, `manager-advisors` pass, `session` specs pass (they flake on the OTP resend cooldown when run back-to-back without `E2E_DB_URL`/`psql`).
- Follow-ups noticed, not changed: (1) onboarding Approve accepts a 1–2 character optional reason the API rejects (<3); (2) `LeadStatusRow.bank` has no `code`, so lead pages derive the bank mark from the first word of the name — add `bank.code` to the DTO; (3) the demo seed stamps config `updatedAt` without history rows ("last change" shown but History says never changed); (4) the demo Telecaller is PASSED without module attempt rows; (5) retention dry-run cards are tall on phones; (6) Manager/Accounts `AppShell` still the plain F-801 shell.
