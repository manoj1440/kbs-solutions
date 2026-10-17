# F-815 — Mobile: Today agenda + MIS freshness on the role homes (keeps F-805 indigo + gold)

- Group: UX shells · Status: **IN_PROGRESS** · Depends on: F-805 (mobile design system), F-814 (web patterns this mirrors)
- PRD refs: REQ-15 §15.2 (Manager dashboard), REQ-20 §20.3 (upload freshness), REQ-25 (screen inventory)
- Origin: user request (2026-10-17): "what about mobile app?" → "keep its indigo and gold, and before pushing any changes give me before and after screenshots".

## 0. Decisions (user, 2026-10-17)
| Topic | Decision |
|---|---|
| Palette | **Keep F-805 indigo + gold.** No token, font or component-library change. Only patterns move over from F-814. |
| Patterns | Greeting home, a **Today** agenda list, **MIS freshness** where a role reads bank values. |
| Proof | Before/after screenshots of every screen shown to the user **before any push**. |
| Screenshot method | Expo web at 390×844 (F-805 method); native Android rendering is not verified. |

## 1. Audit (before) — 2026-10-17

Method: all 23 role screens + 2 auth screens rendered with Expo web at 390×844 against the dev API on `kbs_dev` (demo data, not reset), two frames each where the screen scrolls (41 PNGs). The demo Telecaller needed a 1-day WFH exception (granted through the Manager API, expires 2026-10-18) to get past the office-network gate.

Every screen renders; no layout breaks or console errors. Findings against the F-814 patterns:

| # | Screen | Finding | Fix (phase) |
|---|---|---|---|
| M1 | All three homes | Greeting with first name already present (F-805). No date line. | Add the IST date under the greeting, same wording as web (`Saturday, 17 Oct`). (P1) |
| M2 | Advisor home | Nothing says what to do today: pending follow-ups live behind the *Follow-ups* tile, unfinished drafts only on *My leads*. | **Today** card under the quick actions: pending actions (top 3), drafts to finish, available-to-claim payout. Each row taps through; empty state is one calm line. (P1) |
| M3 | Manager home | Prime slot under the hero is *Create Telecaller* (a rare admin task, also in Profile). Payouts awaiting the Manager are only a tab on *Approvals*; team callbacks due are only a number in the hero. | **Today** card replaces the slot: payouts awaiting me, pending actions on team leads, callbacks due by telecaller (same three lists as the web Today rail). *Create Telecaller* moves below as a compact row. (P2) |
| M4 | Manager home | Bank-derived numbers (MIS matched, approved) carry no "as of". | MIS freshness line per bank from `GET /mis/freshness` (Manager has `DASHBOARD_MANAGER`): `HDFC MIS · 19d ago`, amber after 7 days. (P2) |
| M5 | Telecaller home | Already agenda-shaped (Due now / Active / Follow-ups tabs). | No change; date line only (M1). |
| M6 | Advisor lead-new without a card | Opening *Create lead* with no `cardId`/`draftId` shows skeletons forever. Normal navigation always passes one, so it is reachable only by deep link. | Out of scope; noted for a later fix. |

Advisor MIS freshness: advisors do not hold a permission for `/mis/freshness`, and every lead row already shows "Last matched MIS: <date>", so no API change.

## 2. Phases
| Phase | Scope | Status |
|---|---|---|
| P0 | Audit, before screenshots, this plan | DONE |
| P1 | Advisor home: date line + Today card (pending actions, drafts, available payout) | DONE |
| P2 | Manager home: date line + Today card (awaiting me, pending actions, callbacks due) + MIS freshness; Create Telecaller demoted | DONE |
| P3 | Telecaller home date line; after screenshots of every screen; typecheck/lint/test; user review before push | DONE (push waits for user review) |

Rules: reuse F-805 components (`Card`, `SectionHeader`, `ListItem`, `Badge`, `EmptyState`, `Appear`); colours only from `@/lib/theme` / the Tailwind tokens; one fetch per list with its own error line (a failed list must not blank the home); no new endpoints.

## 3. Progress notes
- 2026-10-17 P0: audit + plan. Before set (41 PNGs) kept outside the repo; shown to the user with the after set before any push.
- 2026-10-17 P1–P3: `components/today.tsx` (`TodayCard`, `todayLabel` in IST, shared `ago`). Empty sections collapse; when every section is empty one "All caught up" row replaces them; a failed list says "Could not load" on its own row. Advisor: follow-ups to do (`/pending-actions`), leads to finish (`/leads/drafts`), ready to claim (ledger `available`). Manager: payouts awaiting you (`/payouts/requests?awaitingMe=true`), pending actions, callbacks due (`/calling/team/overview`); header sits on the hero (`light`); *Create Telecaller* is now the *My team* header action (still in Profile and the empty state). MIS freshness line under *Advisor pipeline*: banks with an applied MIS (`HDFC Bank MIS · 19d ago`, amber dot past 7 days measured from the server `asOf`) plus "+N banks with no MIS yet". Date line under the name on all three homes.
- Checks: mobile typecheck, lint, test 11/11. Before/after: 41 frames each on the same data (before re-shot with the change stashed); pixel diff > 0.5 % only on the three homes, plus two noise frames (welcome carousel position, a clock timestamp on the call desk). Demo data added in `kbs_dev` for the shots: two Advisor follow-up tasks (via the app API) and the Telecaller WFH exception (until 2026-10-18).
