# F-816 — Web: MIS is a business rule, not the centre of the app (fixed upload formats)

- Group: Web UX · Status: **IN_PROGRESS** · Depends on: F-809 (MIS business view), F-814 (web UI v2), F-303 (calling-list import)
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
| P1 | API: `STANDARD_MIS_FORMAT` in `@kbs/shared`; `MisImportService.create` provisions an APPROVED standard profile when the bank has none; seed reuses the constant. | |
| P2 | Web MIS: upload modal lists every active bank; batch page = result card + rows; profile editor + resolve component removed. | |
| P3 | Web calling list: auto-confirm mapping on upload, wizard without the map step. | |
| P4 | Web wording + shell: MIS clock gone, nav item, home/leads/manager/dashboards/payouts wording, `bankText()` display mapper. | |
| P5 | Checks: typecheck, lint, unit, affected e2e; browser pass. | |

## 3. Acceptance
- [ ] Fresh DB (no profiles): Admin can upload an MIS file for any bank and it applies in one step.
- [ ] No web page outside `/admin/mis*` shows the word "MIS" to the user (dev gallery excepted).
- [ ] Lead never matched shows "Awaiting bank update" on web; mobile unchanged.
- [ ] Calling-list upload goes straight to the check step; wrong-format file gives one message.
- [ ] Bank status still written only by MIS apply (INV-01 tests green).

## Progress notes
