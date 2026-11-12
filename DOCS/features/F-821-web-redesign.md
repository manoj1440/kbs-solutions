# F-821 Web redesign — same system as the app, labelled navigation, one primary action

Status: DONE (2026-11-12, session 27, owner request after F-820: "analyse the web app as well and implement it"; design decisions delegated to engineering).
Supersedes the look of F-817 rounds 2–3 (glass, ambient light, icon-only sidebar). ADR-003 holds (shadcn/ui, tokens). Dark mode stays.

## 1. Analysis (56 pages photographed at 1440, plus sign-in)
| # | Finding | Where |
|---|---|---|
| W1 | **Icon-only sidebar by default.** 15+ unlabelled icons; a page can only be found by hovering each one | every page (`WorkspaceShell`) |
| W2 | **Coloured haze.** Orange / teal ambient light and frosted panels behind every page — the same fog removed from the app in F-820 | `.admin-canvas::before`, `.glass*` |
| W3 | **No single primary action.** Black "Apply" filter buttons carry the same weight as "Create user" / "Upload MIS"; the app uses orange for the primary action, the web black | list pages |
| W4 | **Bank status reads as a link.** Stage / Decision / Activation are teal bold text in tables | leads tables, lead detail |
| W5 | **Top bar noise.** Three theme buttons permanently in the bar; section › page inside a floating pill | every page |
| W6 | **Small figures.** KPI numbers 20 px medium under 11 px labels | KPI strips |
| W7 | **Two accents on the Admin home.** An orange KPI tile showing "0" competes with the payout card | `/admin` |
| W8 | Typeface (Inter) differs from the app (Manrope) | all |

Not a problem (kept): page inventory and layouts, tables (DataTable), sign-in layout, provenance chips, dark mode, phone drawer.

## 2. Decisions
| Area | Before | After |
|---|---|---|
| Canvas / surfaces | cream + ambient light + blur | flat neutral `#F4F3F1`, white cards, no shadow; `.glass*` class names kept but solid |
| Navigation | floating icon rail, labels on demand | docked white sidebar, **labels and section names by default** (collapse still available and remembered; `kbs_nav=0`); active page = orange tint |
| Top bar | pills: breadcrumb, theme, tools, account | plain "Section / Page" text; search, notifications, refresh; **theme moved into the account menu** |
| Primary action | near-black | **orange `#C2410C`** (`--primary`), white text; filter "Apply" buttons are outline, so each page has one primary |
| Bank status | toned bold text | **toned dot + the bank's words in ink** (text unchanged, REQ-20) |
| KPI tiles | 20 px medium | 24 px semibold, 12 px label |
| Hero | orange tile | one dark **ink card** per page (`.hero-ink`, tokens re-pointed inside it): Admin home "Payout earned"; `StatCard emphasis` |
| Type | Inter | Manrope (next/font, self-hosted) |
| Radius | 10 px controls, 16 px cards | 12 px controls, 20 px cards |

## 3. Not changing
Routes, data, API, copy of bank values, provenance chips, table behaviour, the mobile app.

## Progress notes
- **2026-11-12 (session 27) — done.** `globals.css` (light tokens, `--primary` in both themes, ambient light and blur removed, `.hero-ink`), `app/layout.tsx` (Manrope), `workspace-shell.tsx` (sidebar, top bar, theme in account menu), three area layouts (sidebar expanded unless `kbs_nav=0`), `components/status` (dot + ink text), `ui/kit.tsx` (MiniStat, StatCard), `/admin` home (ink payout card, no orange KPI tile), 12 "Apply" buttons → outline.
- **Checks.** Web typecheck, lint, unit 24/24 (status test updated for the dot). Isolated Playwright suite on a production build: 72 passed, 2 skipped — two specs updated (sidebar default, theme toggle location). All 56 Admin / Manager / Accounts routes re-photographed at 1440 with no horizontal overflow; overview, leads, lead detail, payout request, manager team and configuration reviewed; leads pages and sign-in also checked in dark mode.
- **Not checked.** The 390 px sweep of every page was not re-photographed (the phone project of the Playwright suite passes; sign-in was viewed at 390). Dark mode was viewed on the leads pages and sign-in only.
