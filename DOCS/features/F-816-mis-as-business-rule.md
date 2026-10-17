# F-816 — Web: MIS is a business rule, not the centre of the app (fixed upload formats)

- Group: Web UX · Status: **DONE** · Depends on: F-809 (MIS business view), F-814 (web UI v2), F-303 (calling-list import)
- PRD refs: REQ-13 (MIS contract), REQ-14 §14.1 (status labels), REQ-16 §16.3 (freshness), REQ-20 §20.3, REQ-06 §6.1 (customer list)
- Origin: user request (2026-10-17): "Wherever we are uploading MIS or cards info or calling data, we don't take these as key or main thing of the whole application … it's basically a business logic: when the lead is generated the status of this lead should be from MIS only, and MIS format is always same so there is no need for column mapping or error."

## 0. Decisions (user, 2026-10-17)
| Topic | Decision |
|---|---|
| Rule kept | Bank status of a lead still comes **only** from uploaded MIS (INV-01..03, INV-08 unchanged). Only presentation and setup change. |
| MIS upload | **Upload → done.** One built-in standard format for every bank; no per-bank profile/column mapping to set up or approve. Upload applies at once and shows a short result (rows read, leads updated, rows not linked to a lead). No pipeline stepper, no resolve queue, no "new values" acknowledgement. |
| Calling data | **Fixed format too.** No "Map columns" step: columns are read by name; a file without NAME / MOBILE / Pincode is refused with one plain message. |
| Wording | **Plain bank wording** on web: "Bank status", "Awaiting bank update", "Last bank update". "MIS" stays only on the upload page itself. Sidebar MIS clock removed. **Web only** — mobile and the shared/API label (`Awaiting MIS Update`) are untouched; web maps it at display time. |
| Cards | Catalogue uploads are only card image + benefit PDF (no mapping); wording only. |
| Bank coverage (follow-up, same day) | **Fixed format too.** One layout for every bank: a sheet with a `Pincode` column; every pincode listed is one the bank sources. Upload = bank + file → live at once, replacing that bank's list. No profile editor, header check or confirm. |

## 1. Audit (before) — 2026-10-17
| # | Where | Finding | Fix |
|---|---|---|---|
| A1 | Shell (Admin, Manager, Accounts sidebar + phone drawer) | "MIS clock" panel on every page: per-bank last import + "Bank values are the latest accepted MIS only". | Remove from shell and layouts. |
| A2 | Nav | Whole "Bank MIS" group → "MIS imports". | One item "Bank MIS upload" under Leads. |
| A3 | Admin home | "matched in bank MIS · awaiting", "Bank MIS · activation", "N bank MIS rows to resolve" alert, long "Source: … latest accepted bank MIS …" footer. | Business words, no resolve alert, no source footer. |
| A4 | Leads list / table / detail | "Awaiting MIS Update", "Last Matched MIS Update", "MIS freshness" filter, "Latest MIS match first", "Bank status (from MIS only)", "Verified by MIS match", "MIS update history", "No MIS row has matched…". | Bank wording. |
| A5 | Manager pages, report dashboards | "Matched in bank MIS", "Awaiting MIS", "MIS evidence", "Bank MIS values verbatim", "MIS freshness" badges. | Bank wording; freshness badges removed. |
| A6 | Payouts / Accounts | "MIS-evidenced", "MIS evidence", "Eligible date (MIS evidence)", "MIS changed after payment". | "Bank-reported", "Bank evidence", "Bank update after payment". |
| A7 | MIS upload | Disabled until a bank has an **approved MIS profile** (column-mapping editor `/admin/mis/profiles/:id`, DRAFT → approve). Fresh DB = no upload possible. | API provisions the built-in standard format per bank on first upload; profile editor removed (route → `/admin/mis`). |
| A8 | MIS batch page | 5-step stepper, "Parse & map", "Profile headers not found", "Unmapped columns", preview/apply buttons, match-state table with link/prefer/ignore. | One result card + plain rows list. |
| A9 | Calling list | 4-step wizard Upload → Map columns → Validate → Confirm. | Upload → Check → Confirm; mapping auto-confirmed. |

## 2. Phases
| Phase | Scope | Status |
|---|---|---|
| P1 | API: `STANDARD_MIS_FORMAT` in `@kbs/shared`; `MisImportService.create` provisions an APPROVED standard profile when the bank has none; seed reuses the constant. | DONE |
| P2 | Web MIS: upload modal lists every bank; batch page = result tiles + rows; profile editor (route redirects) + resolve component + pipeline removed. | DONE |
| P3 | Calling list: API `create` reads the fixed columns and validates at once (wrong format → 400, no batch); wizard Upload → Check → Confirm. | DONE |
| P4 | Web wording + shell: MIS clock gone, "Bank MIS upload" under Sales, home/leads/manager/dashboards/payouts wording, `lib/bank-text.ts`. | DONE |
| P6 | Bank coverage: `STANDARD_PINCODE_FORMAT` + `UploadCoverageBody` (`@kbs/shared`); `GET/POST /pincode-coverage`; page = banks table (pincodes sourced, last upload) + Upload coverage modal; profile editor removed (`/admin/pincode-profiles/:id` redirects). | DONE |
| P5 | Checks: typecheck, lint, unit, API e2e, web e2e isolated; browser pass. | see notes |

## 3. Acceptance
- [x] Fresh DB (no profiles): Admin can upload an MIS file for any bank and it applies in one step.
- [x] No web page outside `/admin/mis*` shows the word "MIS" to the user (dev gallery excepted).
- [x] Lead never matched shows "Awaiting bank update" on web; mobile unchanged.
- [x] Calling-list upload goes straight to the check step; wrong-format file gives one message.
- [x] Bank status still written only by MIS apply (INV-01 tests green).

## Progress notes
- 2026-10-17 (session 19): P1–P4 built in one session; commits `feat(api): built-in standard MIS format…`, `feat(web): MIS upload = upload and done…`, `feat(calling-list): fixed customer-list format…`, `feat(web): bank status in plain words…`.
- Checks: workspace typecheck; web lint clean; web unit 24/24 (`status-components` now asserts the web wording); API e2e **158/158, 36 suites** on `kbs_test` (new: standard profile auto-provisioned for EQUITAS; calling list wrong format → 400 with no batch); web Playwright isolated (`e2e-isolated.sh`) **73 passed / 1 skipped**.
- Browser pass on the isolated stack (:3300, `kbs_e2e`): sidebar has no MIS clock and one "Bank MIS upload" item under Sales; upload button enabled with no profile approved; a 2-row standard-format AU file uploaded through the same API calls the modal makes → profile "Standard MIS format" v1 created, result page shows Rows 2 · Leads updated 0 · Unchanged 0 · No KBS lead 2 and the rows table. Server-rendered text of `/admin`, `/admin/leads`, `/admin/calling-list`, `/admin/dashboards/advisors`, `/admin/payouts/entitlements`, `/manager`, `/manager/advisors` contains "MIS" only in that nav item. The file picker itself was not driven (the browser pane cannot choose local files).
- Bank coverage (P6): API e2e catalogue + card-availability 12/12 (new: bad file → 400 and the bank's live list unchanged; `PINCODE` header accepted; standard profile becomes the only APPROVED one); web unit 24/24, shared 48/48; web Playwright isolated 73 passed / 1 skipped; browser: RBL list of 3 uploaded through the modal's API call shows on the page, modal opens.
- Not changed (follow-ups): API lead notifications still titled "Matched in bank MIS" / "Bank MIS updated" (shared with mobile); mobile wording; `/mis/rows/:id/resolve`, `/mis/batches/:id/preview`, `/mis/profiles*` API endpoints kept without a web consumer; the old `/pincode-profiles*` + `/pincode-batches*` endpoints stay without a web consumer.
