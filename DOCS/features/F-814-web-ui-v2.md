# F-814 — Web UI v2: refined navy + teal, page by page

- Group: Web UX · Status: **IN_PROGRESS** · Depends on: F-806 (kit), F-811 (compact lists), F-812 (admin home), F-813 (DataTable)
- PRD refs: REQ-20 §20.1–20.5 (shadcn, restrained motion, upload freshness, text not colour-only, a11y), REQ-16 (Admin analytics), REQ-15 (Manager drill-down), REQ-18 (Accounts), REQ-25 (screen inventory)
- Origin: user request (2026-10-17): "do a solid analysis on the repo, then improve it page by page" with two reference dashboards (a light blue admin console, a dark glassy fitness dashboard). Plan first, track progress after each commit.

## 0. Decisions (user, 2026-10-17)
| Topic | Decision |
|---|---|
| Direction | **Refine the KBS navy + teal brand.** Borrow patterns from both references, not their palettes. |
| Dark mode | **Yes, as the final phase** (P8). Token cleanup in every phase makes it possible. |
| Admin home | **Trend chart + change vs previous period, greeting header, Today rail.** This reverses two F-812 removals (deltas; attention items) at the user's request. |
| Scope | **Web only** (Admin, Manager, Accounts, auth/status screens). Mobile stays as F-805. |

Kept from earlier user decisions: list pages keep the F-811 single-screen pattern (tiles → filter row → internally scrolling table → footer, no page title); the Admin home scrolls as a document with period default **Today** (F-812 rounds 2–3); table headers sort by click, no column menus (F-813); no new UI framework (ADR-003).

## 1. Audit (before) — 2026-10-17

Method: all 57 routes rendered against the demo seed at 1440 and 390 (`apps/web/test/admin-shots.mjs`, overflow 0 and no errors on all), code inventory of tokens/shell/kit, `impeccable detect` over `apps/web/src`, impeccable audit rubric.

### Health score (impeccable rubric)
| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Labels, focus and `h1` discipline are good; text tiles use dot + text. Contrast of 10–11 px grey hints on tinted tiles is borderline. |
| 2 | Performance | 3 | Server pages, no chart libs, light motion. Fonts are not loaded at all (see U1). |
| 3 | Theming | 1 | Tokens exist but pages bypass them: 1 048 `slate-*`, 136 `bg-white`, 222 `text-[Npx]`, 78 `shadow-[…]`, 82 hex values. Token primary is blue, workspace overrides to teal. `.dark` palette defined but unusable. |
| 4 | Responsive | 3 | No overflow anywhere; phone card mode works but is long (U12). One desktop page renders phone cards (U2). |
| 5 | Implementation integrity | 3 | Coherent kit, but two tile systems on the home and duplicated local `Stat`/`Panel`. Detector: 2 side-stripe accents, 1 bounce easing. |
| | **Total** | **13/20** | Acceptable — solid structure, weak visual system. |

### Defects (real problems, fix regardless of taste)
| # | Where | Problem |
|---|---|---|
| U1 | `app/layout.tsx`, `globals.css` | **Inter and JetBrains Mono are declared but never loaded.** Every user sees their OS font (Segoe UI on Windows, SF on Mac); IDs fall back to Consolas/Menlo. |
| U2 | `manager` (Team) | Both tables render in phone card mode at 1440: label/value stacks, ~180 px per row, half-empty panels. |
| U3 | `admin/catalogue` | Card titles and fee labels clip mid-word ("AU Bank self-onboarding link (example -", "ANNU"). |
| U4 | `admin` home | Two tile systems (tinted + outlined), 12 tiles in 6 hues, zeros at hero size with empty meters — reads as noise, nothing leads. |
| U5 | token layer | See Theming row. Blocks dark mode and makes every page slightly different. |
| U6 | `data-table` toolbar | "All columns" toggle sits alone on its own row (Leads, others): 44 px of dead space, misaligned with filters. |
| U7 | `payouts/requests` (shared) | Two stacked tab rows (queue + state) with overlapping meaning; long labels ("Payment recorded pending proof"). |
| U8 | `notification-centre.tsx:177`, `workspace-shell.tsx:291` | Thick side-stripe accents (detector). `file-upload-button.tsx:41` bounce easing. |
| U9 | shell, lead detail | Eyebrow labels ("BUSINESS WORKSPACE" under the logo, "WORKSPACE" above the lead name) — noise. |
| U10 | lead detail | ~2 000 px, mostly "Not reported"/blank rows; 36-field snapshot in a nested scroll box; follow-up and remark forms always open; section letters A–D. |
| U11 | shell | Bank MIS freshness only appears in small page footers, though REQ-20.3 asks to "display upload freshness and last matched status". |
| U12 | phone (390) | KPI strips fill the first screen (6 tiles, 2-up); table card rows ~350 px each. |
| U13 | all dashboards | No data visuals at all: no trend, no comparison with the previous period (REQ-16 analytics, REQ-20.2 readable numbers). |
| U14 | detail pages | Back links, hero blocks and action placement differ page to page (lead vs user vs batch vs request). |

### Working well (keep)
- Shell structure: grouped sidebar, breadcrumb, Cmd+K palette, account menu.
- Bank status discipline: three separate badges + provenance chip, verbatim values, "Not reported".
- One `DataTable` for every table; server pagination; skeleton loading states; empty states with guidance.

## 2. What we take from the references
| Reference | Take | Leave |
|---|---|---|
| Light admin (ref 2) | Soft filled active-nav pill; one filled hero KPI tile + quiet siblings; status block in the sidebar footer (→ Bank MIS freshness); avatar stacks for owners/assignees; leading icon per table row; amount + state in one cell; generous table rhythm | Blue rebrand; floating dashboard switcher |
| Dark glassy (ref 1) | Greeting header with date; KPI cards that carry their recent history; one primary area chart with period selector and marked peak; right rail with agenda/schedule; theme toggle in the sidebar footer | Frosted glass over a photo (contrast on dense tables), orange palette, decorative photo cards |

## 3. Design direction — "calm ledger console"
- **Palette:** navy shell `#0B1A2E` family, teal primary (one primary everywhere — token package aligned to teal), neutral cool greys as tokens, semantic tones only where they carry meaning (approved/declined/attention/exception). No rainbow tiles: one tone per meaning.
- **Type:** Inter (UI) + JetBrains Mono (refs, IDs, config keys) loaded with `next/font/google` (self-hosted at build, no runtime third-party request, no new dependency). Scale 12/13/14/16/20/24/30, tabular numerals for all figures, tracking tightened on 24+.
- **Shape & depth:** controls 8 px, tiles 12 px, cards/panels 16 px (as today), pills full; two shadow tokens (`--shadow-card`, `--shadow-pop`) with offset + soft blur; hairline borders from one `--border` token.
- **Density:** 44 px table rows, 36 px controls, 16/24 px panel padding.
- **Motion:** one authored moment per page (content fade/slide 180 ms ease-out); hover lift on interactive cards only; all off under `prefers-reduced-motion`.
- **Signature move — the MIS clock:** bank values are only as true as the last accepted MIS import, so the shell always shows it: sidebar footer block "Bank MIS · as of 2 h ago" with per-bank last accepted import on hover/popover; MIS-derived KPI tiles carry the same "as of". Age is shown neutrally (no invented staleness threshold).
- **Charts:** in-house SVG (`TrendChart`, `MiniBars`, `DeltaBadge`) in the kit — no chart library (ADR-003 / kit rule 7). Every chart has a visible legend, keyboard-focusable points with tooltips, and an accessible table fallback; deltas are text-encoded ("▲ 12% vs prev. period"), never colour-only.

## 4. Principles (guard-rails)
1. Bank values verbatim; Stage / Decision / Activation remain three labelled badges with provenance (INV-01…03, INV-08). No aggregate may hide a conflicting MIS row (REQ-20.4).
2. Presentation changes keep routes, form `name`/`id`, button labels, `h1`, dialog labels and `data-label` values that e2e uses. Any rename is listed in the commit and the spec updated in the same commit.
3. API changes only in P1 (`GET /mis/freshness`, read-only, for the MIS clock) and P2 (read-only dashboard endpoints), with e2e tests; nothing writes bank data.
4. No new runtime dependencies (fonts come from `next/font`, already part of Next).
5. Every touched page leaves on tokens only: no `slate-*`, `bg-white`, hex, `text-[Npx]` or arbitrary `shadow-[…]` in that page's files.

## 5. Plan — phases (each ≈ one session, small commits)

### P0 — Foundation (kit + tokens)
- Load Inter + JetBrains Mono via `next/font/google`, wire to `--font-sans`/`--font-mono` (U1).
- Tokens in `globals.css` (`:root` + `@theme inline`): `canvas`, `surface-muted/strong/selected`, `fg-2`, `fg-3`, `border-subtle/strong`, `navy`/`navy-2`/`navy-3`, `shadow-card`/`shadow-pop`. Teal primary set on `:root` for all web pages. **Correction:** the `@kbs/ui-tokens` package is left unchanged — mobile reads it (F-805).
- Kit: `TrendChart`, `MiniBars`, `DeltaBadge`, `Sparkline`, `DetailHeader` (U14), `RailCard`; `StatCard` gains `delta`/`chart` slots instead of a separate `KpiTile` (its `emphasis` variant is the hero tile); kit and data-table internals moved to tokens.
- Fix U8 (side stripes → dot/indent, bounce → ease-out), U6 (column toggle joins the filter row).
- Guide: update `components/ui/README.md` (tokens, new components, per-page definition of done).

### P1 — Shell
- Sidebar: soft filled active pill (ref 2), quieter group labels, eyebrow under logo removed (U9), **MIS clock** block + user card in the footer, theme-toggle slot (enabled in P8).
- Top bar: breadcrumb, search, notifications, refresh, account — tokens + spacing. (The planned top-bar MIS chip was dropped: the sidebar and the phone drawer both carry the MIS clock, and MIS pages keep their own as-of footers — U11 is covered without repeating it.)
- Mobile nav drawer restyled; focus and reduced-motion checks.

### P2 — Admin home (API + web)
- API (read-only, `DASHBOARD_ADMIN`): `GET /dashboards/admin/home` gains `previous` (same shape, preceding equal-length range) for deltas; `GET /dashboards/admin/trend?from&to&bucket=day|week` → per bucket `{leadsCreated, approved, activated, payoutEarnedInr, calls, connected}` using the F-812 rules (`decisionBucket`/`activationBucket`, lead created date, payout eligible date); `GET /dashboards/admin/today` → counts + top items for follow-ups/callbacks due, payout requests awaiting Admin, advisors pending onboarding review (reuse owning services; prefer existing endpoints if they already give this). E2E: totals reconcile with `/admin/home`, buckets sum to the period, Manager → 403.
- Web: greeting header (IST time of day, date, MIS clock), period control, KPI row (one hero + 3, each with `DeltaBadge`), trend area chart with series toggle and marked peak, calling funnel as `MiniBars`, recent leads table, **Today rail** on the right (stacks under content on phone). Team counts move into the greeting meta line (U4).

### P3 — Sales & calling
Leads browser (U6, U12 compact phone rows), lead detail (U10: `DetailHeader` with the three bank tiles, unreported fields collapsed behind "24 not reported", tabs or anchored sections for Bank fields / KBS activity / MIS history / Payout, forms open on demand), calling records, calling list detail + wizard, caller performance + telecaller drill-down, distribution.

### P4 — Bank MIS, payouts, Accounts
MIS records, batch, profile, integrity; payout requests (U7: one segmented control for queue, state as filter select), request detail (stepper on `DetailHeader`), entitlements, liability, rules + rule detail; Accounts queues, reconciliation, request detail (payment + proof emphasis, REQ-18).

### P5 — People, products, settings
Users + user detail, onboarding + review detail, training content/module/progress/team, catalogue (U3) + card editor, bank coverage + profile editor, compliance, network, config, retention, audit, notifications, account.

### P6 — Manager workspace
Manager home + dashboard (greeting + team agenda rail: callbacks due, pending actions), Team (U2: real desktop tables), team calling + telecaller drill-down, advisors + advisor detail, team leads + lead detail, pending actions, payouts (home, requests, detail, liability), create telecaller.

### P7 — Auth, status screens, final QA
Login (+ showcase panel on tokens), session hop, access denied, not found/error, public ID verify; full sweep, `/impeccable audit` re-score (target ≥ 17/20), docs.

### P8 — Dark mode
`.dark` palette from the token layer, theme toggle in the sidebar footer (system / light / dark, stored per browser), charts and badges checked for contrast in both themes, screenshot sweep in dark.

## 6. Page tracker

Status: `TODO` → `DONE` (set in the same commit that finishes the page). Commits: `git log --oneline --grep F-814`.

| Phase | Page / unit | Route(s) | Status |
|---|---|---|---|
| P0 | Fonts + tokens + kit charts + guide | — | DONE |
| P0 | Detector fixes (side stripes, bounce), column toggle placement | — | DONE |
| P1 | Sidebar + MIS clock + user card | all workspaces | DONE |
| P1 | Top bar + mobile drawer | all workspaces | DONE |
| P2 | Dashboard API: previous period, trend, today (+ e2e) | `/dashboards/admin/*` | TODO |
| P2 | Business overview | `/admin` | TODO |
| P3 | Leads browser | `/admin/leads` (+ shared Manager browser) | TODO |
| P3 | Lead detail | `/admin/leads/[id]`, `/manager/leads/[id]` | TODO |
| P3 | Calling records + list detail/wizard | `/admin/calling-list`, `/admin/calling-list/[id]` | TODO |
| P3 | Caller performance + telecaller drill-down | `/admin/calling-list/performance(/telecaller/[id])` | TODO |
| P3 | Distribution | `/admin/calling-list/distribution(/telecaller/[id])` | TODO |
| P4 | MIS records | `/admin/mis` | TODO |
| P4 | MIS batch + profile + integrity | `/admin/mis/batches/[id]`, `/admin/mis/profiles/[id]`, `/admin/mis/integrity` | TODO |
| P4 | Payout requests list (shared) | `/admin/payouts/requests`, `/manager/payouts/requests`, `/accounts` | TODO |
| P4 | Payout request detail (shared) | `/admin/payouts/requests/[id]`, `/manager/…/[id]`, `/accounts/requests/[id]` | TODO |
| P4 | Entitlements ledger | `/admin/payouts/entitlements` | TODO |
| P4 | Liability (shared) | `/admin/payouts/liability`, `/manager/payouts/liability` | TODO |
| P4 | Payout rules + rule detail | `/admin/payouts/rules(/[id])` | TODO |
| P4 | Accounts reconciliation | `/accounts/reconciliation` | TODO |
| P5 | Users + user detail | `/admin/users(/[id])` | TODO |
| P5 | Advisor approvals + review | `/admin/onboarding(/[userId])` | TODO |
| P5 | Training content, module, progress, team detail | `/admin/training(/[seq])`, `/admin/training/team(/[id])` | TODO |
| P5 | Card catalogue + card editor | `/admin/catalogue(/[id])` | TODO |
| P5 | Bank coverage + profile editor | `/admin/pincode-profiles(/[id])` | TODO |
| P5 | Reports (telecallers, managers, advisors, bank/card mix) + audit | `/admin/dashboards/*`, `/admin/audit` | TODO |
| P5 | Compliance, network, config, retention | `/admin/compliance`, `/admin/network`, `/admin/config`, `/admin/retention` | TODO |
| P5 | Notifications + account (shared, all roles) | `/*/notifications`, `/*/account` | TODO |
| P6 | Manager home (Team) | `/manager` | TODO |
| P6 | Manager dashboard + agenda rail | `/manager/dashboard` | TODO |
| P6 | Team calling + telecaller drill-down | `/manager/calling(/telecaller/[id])` | TODO |
| P6 | Advisors + advisor detail | `/manager/advisors(/[id])` | TODO |
| P6 | Pending actions | `/manager/pending-actions` | TODO |
| P6 | Payouts home | `/manager/payouts` | TODO |
| P6 | Telecaller detail + create | `/manager/telecallers/[id]`, `/manager/telecallers/new` | TODO |
| P7 | Login | `/login` | TODO |
| P7 | Status screens + public verify | `/session`, `/access-denied`, not-found/error, `/verify/[ref]` | TODO |
| P7 | Final sweep + audit re-score + docs | — | TODO |
| P8 | Dark palette + toggle | all | TODO |
| P8 | Dark sweep + contrast fixes | all | TODO |

### Definition of done (every page)
- [ ] Tokens only in the page's files (no `slate-*`, `bg-white`, hex, `text-[Npx]`, `shadow-[…]`).
- [ ] Kit components only (`KpiTile`, `DetailHeader`, `DataTable`, …); no page-local copies.
- [ ] Empty, loading, error and disabled states designed; "Not reported" for blank bank values.
- [ ] 1440 and 390 screenshots: overflow 0, no clipping, phone first screen shows the task, not just tiles.
- [ ] `impeccable detect` on the page's files: 0 primary findings.
- [ ] e2e selectors unchanged (or spec updated in the same commit); bank badges unchanged.

## 7. Verification per phase
`pnpm --filter web typecheck lint test`; screenshot sweep 1440 + 390 (`node apps/web/test/admin-shots.mjs`, `BASE=http://localhost:3000 API=http://localhost:4000/api/v1`); web Playwright for touched areas (`E2E_PG_CONTAINER=kbs-test-pg E2E_PG_DB=kbs_dev`); P2 adds API e2e on the disposable `kbs_test` DB; P7 runs the full suites and `next build`.

## Acceptance criteria
- [ ] U1–U14 fixed.
- [ ] Every page in the tracker DONE against the definition of done.
- [ ] Admin home shows greeting, KPI deltas vs previous period, trend chart and Today rail; API e2e green.
- [ ] MIS clock visible in every workspace.
- [ ] Impeccable audit ≥ 17/20; dark mode passes contrast on every page.
- [ ] typecheck, lint, unit, API e2e, Playwright, build pass.

## Progress notes
- Session 19 (2026-10-17): audit + plan written (this file).
- Session 19, P0 done. Commits: `docs(F-814): start` → `fix(web): load Inter + JetBrains Mono via next/font` (U1; verified `document.fonts` has Inter loaded) → `refactor(web): semantic tokens …` (U5 groundwork: `:root` tokens, globals.css hex → tokens, kit/ui primitives/DataTable on tokens, `test/tokenize.mjs` codemod for later phases) → `feat(web): kit data visuals …` (TrendChart/DeltaBadge/Sparkline/MiniBars/DetailHeader/RailCard, shown in `/dev/components`) → `fix(web): detector findings and leads column toggle placement` (U6, U8; detector now clean on `apps/web/src`). Guide updated: `apps/web/src/components/ui/README.md`.
- P0 checks: web typecheck + lint clean, web unit 24/24, Playwright 73 passed / 1 skipped (desktop + phone, against `next dev`), screenshot spot checks (leads, payouts, catalogue, notifications) overflow 0, leads toggle 6 → 13 → 6 columns.
- Found: `apps/web/test/admin-layout-smoke.mjs` clicks a "Full table view" button that no longer exists (stale since F-813) — not part of `pnpm test:e2e`; fix when P3 touches leads.
- Fixed on the way: `admin-smoke` F-808 test used `getByLabel('Current status')`, which also matched the F-813 "Sort by Current status" header button (failing since `6c2bf0d`); now `exact: true`.
- Session 19, P1 done. Commits: `feat(api): GET /mis/freshness` (per active bank: last APPLIED import or null; Admin/Manager/Accounts, Telecaller 403; e2e in `mis-apply.e2e-spec.ts`) → `feat(web): shell v2` (`components/mis-clock.tsx` in sidebar + drawer, navy tokens, brand subtitle without eyebrow, top bar/menus/search on tokens, refresh hidden on phones, drawer = scrolling nav + pinned clock and user card).
- MIS clock rules: per bank, never one global status (REQ-16 §16.3); age neutral ("2 h ago", date after 7 days, exact time on hover), "Never imported" explicit; tooltip says bank values are the latest accepted MIS only. SSR uses the API's `asOf` as "now" so hydration matches; ticks every minute.
- P1 checks: api typecheck/lint, `mis-apply` e2e 6/6; web typecheck/lint; Playwright 73 passed / 1 skipped; screenshots Admin/Manager/Accounts at 1440 + phone drawer at 390 (overflow 0).
- Next: P2 Admin home (API: previous period, trend, today; web: greeting, KPI deltas, trend chart, Today rail).
