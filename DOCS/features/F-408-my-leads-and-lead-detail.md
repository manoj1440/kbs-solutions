# F-408 My Leads list, search, filters and lead detail with MIS history

- Group: Advisor · Status: **PLANNED** · Depends on: F-407, F-506
- PRD refs: REQ-11 §11.8 (columns; search by name/mobile/reference; filters issuer/card/date/stage/decision/activation/MIS freshness/actionable; sort; own leads only), §11.9 (A/B/C/D sections; no fictional timeline; chronological MIS update history with exact values and upload time; operational tasks labelled Follow-up task), REQ-12 S24–S27, REQ-14 §14.2–14.6, REQ-20 §20.3
- QA ids: FOS-06, VIEW-01, VIEW-02, MIS-02, MIS-05, MIS-06

## Detailed requirements
1. `GET /leads?q&bankId&cardId&from&to&stage&decision&activation&misFreshness=never|older7d|older30d|recent&actionable&sort` scoped to actor (Advisor own; Manager team; Admin all) returning the F-506 `LeadStatusRow` DTO.
2. Lead detail `GET /leads/:id` → sections: (A) customer (masked), card, operational events (created, link shared/opened, reference entered, remarks, follow-up tasks); (B) bank references and latest `BankStatusSnapshot` with raw values and `lastMatchedAt`; (C) bank remarks grouped (DROPOFF_REASON, DECLINE_CODE, DECLINE_DESCRIPTION, Decline Descreption, Decline Type, Reason) and Bank/KYC information (CURABLE_FLAG, KYC Status, VKYC_STATUS, BKYC Status, VKYC dates); (D) payout summary when applicable (F-603).
3. `GET /leads/:id/mis-history` → grouped by batch: field, old→new, changeKind, reported event date, imported at, uploader role.
4. Mobile: My Leads (compact rows F-506), filter sheet, lead detail with expandable sections and MIS history list; web: full table with expandable rows.
5. No "timeline" component with predefined steps exists in the codebase (VIEW-02 grep test).

## Acceptance criteria
- [ ] FOS-06/VIEW-01: three distinct badges + last matched date per row; operational vs MIS history separated.
- [ ] MIS-02/05/06 render correctly from fixtures.
