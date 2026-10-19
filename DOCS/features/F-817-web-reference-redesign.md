# F-817 — Web: reference redesign (neutral canvas, black primary, orange accent, top pill nav + slim rail)

- Group: Web UX · Status: **DONE** · Depends on: F-814 (tokens/kit v2), F-813 (DataTable), F-816
- PRD refs: REQ-20 (UX/visual constraints: text always carries meaning, contrast), REQ-25 (screen inventory), ADR-003 (shadcn/ui)
- Origin: user request (2026-10-19) with a reference dashboard image ("Vertix" finance dashboard): "see the design tokens, understand the visuals and aesthetics of this image and convert the current web admin into this one … do not make mistakes and approve all decisions by default."
- Supersedes the F-814 navy + teal look (F-814 P8 dark mode stays a separate, later phase).

## 0. Reference read-out (design tokens)
| Token | Reference | Web value |
|---|---|---|
| Canvas | flat light grey | `--canvas: 0 0% 93%` (#EDEDED) |
| Surface | white cards, no visible border, no real shadow | `--card` white, `--border: 0 0% 91%`, `--elev-card` hairline |
| Inner surface | soft grey tiles inside cards | `--surface-muted: 0 0% 96%` |
| Text | near-black headings, mid-grey secondary | `--foreground: 0 0% 9%`, `--fg-2: 0 0% 32%`, `--muted-foreground`/`--fg-3: 0 0% 45%` (≥4.5:1 on white) |
| Primary | black pill buttons, black active nav pill | `--primary: 0 0% 9%` |
| Accent | one orange (hero KPI gradient, chart "profit" bars, progress, logo, unread dot) | `--brand: 14 87% 55%` (#F05A28), `--brand-strong: 17 88% 40%` for text on white |
| Shape | cards ≈22px, inner tiles ≈16px, every button / input / select / nav item a full pill | `--radius-2xl: 22px`, `rounded-full` controls |
| Type | Inter-like; 36px medium greeting; 28px semibold figures; 12–13px labels | Inter (already loaded) |
| Delta chips | small tinted pills `↑ 5%` green / `↓ 5%` red | `DeltaBadge` |
| Table | grey rounded header row, white rows, no vertical rules, status = dot + text | table CSS |

## 1. Decisions (auto-approved by the user, 2026-10-19)
| Topic | Decision |
|---|---|
| Palette | Monochrome + one orange accent. Decorative teal / indigo / violet classes become neutral greys (codemod); emerald / amber / rose / sky keep their meaning (success / warning / danger / info). Status text always present (REQ-20 §20.2). |
| Shell | Floating top bar on the canvas: logo pill · section pill-nav (black active pill) · icon pill (search ⌘K, notifications, refresh) · user pill (menu with account + sign out). Slim left rail = the pages of the active section, icon in a circle (black when active) **with a small label** so 20+ pages stay findable (reference rail is icon-only; labels added for orientation since many pages have no visible title). Below `xl` the section nav moves into the drawer; below `md` the rail goes too. Breadcrumb removed (section pill + rail label carry it). |
| Admin home | Reference grid: payout "balance" card (amount, delta, two pill buttons, team members as "wallet" mini-cards) · 2×2 KPI tiles with the orange hero · stacked bar chart (approved vs other leads) · calling progress card + Today queues · recent leads table with search. Calling performance + all-time below. Same data, same endpoints. |
| Manager / Accounts | Same shell and tokens (shared component). |
| Login | Accent switches teal → orange; layout unchanged. |
| Dark mode / theme toggle | Not in this feature (reference shows a toggle; a non-working toggle would be a mistake). Still F-814 P8. |
| Mobile app | Untouched (`@kbs/ui-tokens` unchanged). |

## 2. Phases
| Phase | Scope | Status |
|---|---|---|
| P0 | Before screenshots (isolated stack, 1440 + 390) | DONE |
| P1 | Tokens + primitives (button, badge, input, select, table CSS) + codemod teal/indigo/violet → neutral | DONE |
| P2 | Shell: top bar, section pills, rail, drawer, search dialog | DONE |
| P3 | Kit: StatCard / SectionCard / MiniStat / IconTile / RailCard / Callout / charts on the new look; orange hero | DONE |
| P4 | Admin home in the reference layout | DONE |
| P5 | Sweep every route at 1440 + 390; fix leftovers; login accent | DONE |
| P6 | Checks: typecheck, lint, unit, isolated Playwright; after screenshots | DONE |

## 3. Acceptance
- [x] Every web route renders on the new tokens with no horizontal page scroll at 1440 / 1280 / 390.
- [x] No teal / indigo / violet / navy class left in `apps/web/src`.
- [x] Section pill nav + rail reach every page reachable before (same hrefs; e2e nav test green).
- [x] Admin home shows the same figures as before in the reference layout.
- [x] Web Playwright isolated suite green.

## Progress notes
- 2026-10-19, round 2 (user: "keep the nav bar in left only … icons only and collapsable with their labels; copy the orange/teal/creamy colour tokens"): **supersedes the top section pill-nav and rail in §1.** One left sidebar (floating white panel) holds every section and page: collapsed = icons only (default, tooltip + `aria-label`), expanded = section labels + page labels; toggle remembered in the `kbs_nav` cookie (layouts read it so the first paint matches). Top bar = section › page pill + search / notifications / refresh + user pill. Drawer below `md`. Palette warmed: cream canvas `36 27% 93%`, warm-white cards, inner tiles `38 30% 96%`, warm greys (`neutral-*` → `stone-*` codemod), orange stays the hero accent (`violet` tone = orange), **teal** is the secondary / positive accent (`--success`, `emerald-*` → `teal-*`, `teal` tone = teal bars). Checks: typecheck, lint, web unit 24/24, Playwright isolated 73 passed / 1 skipped (nav test rewritten for collapse/expand + cookie), 47 routes × (1440 collapsed, 1280 expanded, 390) with no horizontal overflow.
- 2026-10-19 (session 20): built in one session. Commits: `docs(F-817): start`, `feat(web): reference look — neutral tokens, pill primitives, top bar + rail shell, home grid`, then sweep fixes (sentence-case labels instead of uppercase kickers, table header case, login + status-screen accent, ops-dashboard hero) and docs.
- Tokens live on `:root` in `apps/web/src/app/globals.css` (`--brand*`, neutral greys, `--radius-2xl: 22px`, `.brand-gradient`, `.brand-hatch`). `@kbs/ui-tokens` (mobile) untouched.
- Codemod: every `teal|indigo|violet-N` class in `apps/web/src` → `neutral-M` (50→100 … 600/700→900); `rg "(teal|indigo|violet)-[0-9]"` returns nothing. Tone *names* in the kit stay (`tone="teal"` = brand orange bar, neutral chip).
- Kit: `SectionCard` / `PageHeader` no longer render header icons (prop kept); `MiniStat` turns grey inside a card (`in-data-[slot=card]`); new `StackedBars` chart (approved black + other leads orange-hatched; approved is a subset of leads per bucket, so the stack is honest; numbers also in a hidden table).
- Shell: rail labels added on purpose (see §1). e2e `admin-smoke` nav test rewritten for sections + rail + drawer (all hrefs unique, > 20 pages).
- Checks: web typecheck + lint clean, web unit 24/24, Playwright isolated 73 passed / 1 skipped (production build). Sweep: all 47 static Admin/Manager/Accounts routes at 1440 and 390 — no horizontal overflow; contact sheets reviewed. Before/after screenshots were made on the isolated stack (`kbs_e2e`, near-empty data).
- Not done: dark mode / theme toggle (F-814 P8); dynamic detail routes were reviewed only where the isolated data has records; native Android untouched.
