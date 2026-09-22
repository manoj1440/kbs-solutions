# F-408 My Leads list, search, filters and lead detail with MIS history

- Group: Advisor · Status: **DONE** · Depends on: F-407, F-506
- PRD refs: REQ-11 §11.8 (columns; search by name/mobile/reference; filters issuer/card/date/stage/decision/activation/MIS freshness/actionable; sort; own leads only), §11.9 (A/B/C/D sections; no fictional timeline; chronological MIS update history with exact values and upload time; operational tasks labelled Follow-up task), REQ-12 S24–S27, REQ-14 §14.2–14.6, REQ-20 §20.3
- QA ids: FOS-06, VIEW-01, VIEW-02, MIS-02, MIS-05, MIS-06

## Detailed requirements
1. `GET /leads?q&bankId&cardId&from&to&stage&decision&activation&misFreshness=never|older7d|older30d|recent&actionable&sort` scoped to actor (Advisor own; Manager team; Admin all) returning the F-506 `LeadStatusRow` DTO.
2. Lead detail `GET /leads/:id` → sections: (A) customer (masked), card, operational events (created, link shared/opened, reference entered, remarks, follow-up tasks); (B) bank references and latest `BankStatusSnapshot` with raw values and `lastMatchedAt`; (C) bank remarks grouped (DROPOFF_REASON, DECLINE_CODE, DECLINE_DESCRIPTION, Decline Descreption, Decline Type, Reason) and Bank/KYC information (CURABLE_FLAG, KYC Status, VKYC_STATUS, BKYC Status, VKYC dates); (D) payout summary when applicable (F-603).
3. `GET /leads/:id/mis-history` → grouped by batch: field, old→new, changeKind, reported event date, imported at, uploader role.
4. Mobile: My Leads (compact rows F-506), filter sheet, lead detail with expandable sections and MIS history list; web: full table with expandable rows.
5. No "timeline" component with predefined steps exists in the codebase (VIEW-02 grep test).

## Acceptance criteria
- [x] FOS-06/VIEW-01: three distinct badges + last matched date per row; operational vs MIS history separated.
- [x] MIS-02/05/06 render correctly from fixtures.

## Progress notes
- `LeadListQuery` (shared) now: `q` (name / mobile in any Indian format / KBS ref / bank reference — status text is never searchable), `bankId`, `cardId`, `from`/`to` (IST days), `stage`/`decision`/`activation` (exact bank value, case-insensitive; sentinels `FILTER_AWAITING`, `FILTER_NOT_REPORTED`), `misFreshness` never|recent|older7d|older30d, `actionable` (no MIS match + no verified reference), `sort` (createdAt / lastMatchedAt with never-matched always last / customer). `GET /leads/filters` returns distinct verbatim values in scope. Scope: Advisor own, Manager team, Admin/Accounts all; `GET /leads/:id/mis-history` now enforces the same scope.
- Detail: `operationalEvents` (section A — lead created, link shared/opened, reference entered/corrected, shares; all `KBS_OPERATIONAL`), `bankStatus.raw` + dates (B), `bankRemarks{remarks,kyc}` (C). Section D shows a placeholder until F-603; follow-up tasks and operational remarks join section A with F-409/F-410.
- Web: `components/leads-browser.tsx` (URL-driven filters + F-506 table + paging) on `/admin/leads` and `/manager/leads`; `components/lead-detail.tsx` on `/admin/leads/[id]` and `/manager/leads/[id]` (history grouped by batch; unchanged / blank fields collapsed under a `<details>` summary; identical repeats say so). Browser-checked (`scratchpad/leads-admin.png`, `lead-detail.png`).
- Mobile: My Leads search + filter sheet (sort, MIS freshness, actionable, issuer, card, stage/decision/activation chips from `/leads/filters`); lead detail with collapsible sections A/B/C and MIS history list.
- Tests: `apps/api/test/leads-list.e2e-spec.ts` (FOS-06/VIEW-01 rows + scoping, search modes, every filter + sort, filter options, detail sections, history). VIEW-02 grep guard from F-506 still passes.
