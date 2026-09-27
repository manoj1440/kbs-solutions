# F-808 Admin Calling: one records page + one caller performance page

- Group: Telecaller ops · Status: **DONE** · Depends on: F-303, F-305, F-307, F-313, F-314, F-807
- PRD refs: REQ-06 (calling list import, record states §6.5), REQ-08 (outcomes §8.6, masking §8.3), REQ-15 §15.3 / REQ-16 §16.3 (evidence counts, provider-confirmed "connected")
- Origin: user request (2026-09-27): "Calling — a single page: upload Excel at the top, tiles with clear numbers of what is in the system, then all records in a table (100 per page, paginated, search by status, name, pincode). Another page for caller performance. Make sure we have all the data."

## Audit (before)
Calling had four entry points: Calling lists (batches only, no records), Allocation (distribution cards + a records table limited to active/follow-ups/hidden, max 100, no paging, no pincode/status filter), Calls & delivery (telephony oversight), Telecaller drill-down. There were no system-wide record counts; the Admin records list defaulted to "active", which silently mixed import-review rows in and left closed rows out.

## Record status (one per row, mutually exclusive, sums to total)
Derived in this order: import excluded → needs import review → do not contact (suppressed) → waiting for a caller (accepted, unassigned) → the interaction status of the assigned record.

| Key | Label | Meaning |
|---|---|---|
| `NEEDS_REVIEW` | Needs import review | Row imported with a problem; accept or exclude in its batch |
| `EXCLUDED` | Excluded at import | Excluded with a reason; never called |
| `DO_NOT_CONTACT` | Do not contact | Suppressed (DNC list or customer request) |
| `UNASSIGNED` | Waiting for a caller | Accepted, no Telecaller yet (consent gate or no eligible caller) |
| `UNTOUCHED` | Not yet called | Assigned, no outcome recorded |
| `UNREACHABLE` | Not reachable | Last outcome no answer / failed |
| `FOLLOW_UP` | Follow-up scheduled | Callback booked |
| `INTERESTED` | Interested | Connected, customer interested |
| `LINK_SHARED` | Link / PDF shared | Application link or benefit PDF shared |
| `DECLINED` | Declined | Closed: not interested |
| `COMPLETED` | Completed | Closed: nothing further |

"Converted" is deliberately **not** a label: a calling record never carries a bank result (bank outcomes come only from MIS on Advisor leads, INV-01/INV-05). The furthest KBS-known step is "Link / PDF shared".

## Tiles
Customer records (total, batches) · Waiting for a caller · Not yet called · Called at least once (distinct records with a call attempt; provider-connected underneath) · Outcome recorded (worked) · Interested / link shared · Follow-ups due now · Closed / do not contact · Needs import review.

## Pages
- `/admin/calling-list` **Calling records** (one screen, no page scroll on desktop): uploads needing action (one amber line, only when present), 8 compact tiles (tile = status filter), toolbar with name / pincode / status / caller filters + "Upload customer list" (existing mapping wizard), records table 100 per page with sticky header and its own scroll, reassignment per row, paging in the footer.
- `/admin/calling-list/performance` **Caller performance** (same layout): 8 tiles (callers, records held, follow-ups due, attempts, connected, outcomes, shares, need reassignment), Callers | Calls & delivery tabs, date range, per-caller evidence table (F-313) with drill-down at `performance/telecaller/[id]`. `/admin/calling-list/distribution` (and its telecaller drill-down) redirect.

## API
- `GET /calling/records` gains `status` (keys above) and `pincode` (prefix); `pageSize` stays ≤100.
- `GET /calling/records/summary` (same permissions and scope): counts per status + attempted / connected / follow-ups due / batches needing action.

## Acceptance criteria
- [x] Sidebar Calling = Calling records, Caller performance; no functionality lost (upload wizard, batch history, reassignment, distribution, oversight, drill-down reachable).
- [x] Status counts sum to total records; each tile/filter uses the same definition (API e2e).
- [x] Table: 100 per page, paging, status / name / pincode / caller filters; mobiles masked.
- [x] typecheck, lint, unit, API e2e (calling-queue), web Playwright green; route sweep.

## Progress notes
- 2026-09-27 (session 14): built and verified.
  - Shared `RECORD_STATUSES` / `RECORD_STATUS_LABELS` / `recordStatusOf` (+ tests); API `GET /calling/records/summary`, `status` (incl. `ALL`) + `pincode` on `GET /calling/records`, rows carry `recordStatus` and `batchId` (e2e: counts sum to total, each status list matches its count, Manager scope, Telecaller 403).
  - User feedback round: removed page titles/descriptions (breadcrumb is enough), the Caller performance button, upload history and table captions; compact `MiniStat` tiles; desktop pages fit the viewport (`lg:h-[calc(100dvh-6rem)]`) and only the table scrolls (checked with 100+ rows at 1280×720 and 1440×900); workspace top bar 64→48 px, main padding 32→24 px (all web areas). Phones keep normal page scroll. Screen-reader `h1` kept on both pages.
  - Admin performance page no longer shows the distribution cards: per-caller load is in the table (queue, follow-ups), unassigned and need-reassignment are tiles, per-record reassignment is on Calling records. `CallingDistribution` unchanged for Managers.
- Checks: typecheck, lint (existing TanStack warning), unit (shared 47, web 15, mobile 11), API e2e 147/147, web build, Playwright 80 passed / 1 skipped / 1 failed (below).
- Known issue found, not fixed (pre-existing, needs a security decision): the phone run of `session.spec.ts` "lapsed access cookie is renewed silently" fails. The notification-bell poll on the page being left gets a 401 and refreshes at the same instant as the `/session` hop; the browser aborts the first response after the server rotated the token, so the hop re-uses the old token and REFRESH_REUSE revokes the session (seen as 4 × `auth.refresh.reuse`). Options: a short grace window for a just-rotated token (API) or serialising client refreshes (`navigator.locks`). REQ-21 §21.5 governs reuse detection — decide before changing.
- Not changed: the Calls & delivery tab (`/oversight`) still has its own header and filters.
- 2026-09-27 (user feedback round 2): tiles are display-only again (no tile→filter links on either page); "Upload customer list" opens a modal (`new-batch.tsx` uses the native `<dialog>` pattern like `ReassignForm`) which holds the file pick and batch create, then proceeds to the existing mapping wizard; "mobiles masked" caption removed from the records footer; `/admin/calling-list/oversight` rebuilt on the same one-screen layout — MiniStat row, merged compact filter bar, attention reasons as small filter chips, call-states/failure-reasons in a collapsible `<details>`, table scrolls inside the panel; telecaller drill-down (`TelecallerActivity`, shared with Manager) got a slim header (avatar + badges + range) and MiniStat tiles instead of the big PageHeader/StatGrid.
