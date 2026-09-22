# F-506 Status display: DTO shaping, web table, mobile row, badges

- Group: MIS · Status: **DONE** · Depends on: F-505, F-803
- PRD refs: REQ-14 §14.1 (no fixed state machine; independent fields), §14.2 (table columns and source rules), §14.3 (mobile row layout; full details; never one overloaded chip), §14.4 (activation display table; Approve + INACTIVE coexist; card setup ≠ activation), §14.5 (remarks grouping; operational remarks separate), REQ-20 §20.2–20.4 ('Not reported' not a dash), REQ-13 §13.6
- QA ids: VIEW-01, VIEW-02, MIS-02, MIS-03, MIS-04, MIS-06

## Detailed requirements
1. `LeadStatusRow` DTO (shared schema): customer (masked), bank/card (+ crosswalked catalogue card if mapped), kbsRef, bankApplicationNo, bankApplicationReference, leadCreatedAt, bankCreationDate (with which column it came from), `stage`, `decision`, `activation` as `StatusField` objects (F-004), remarksPreview (first non-blank of the grouped reason fields, truncated), lastMatchedAt, actions.
2. `bankValueDisplay` rules: never matched → "Awaiting MIS Update"; matched but blank → "Not reported"; else raw text verbatim (`V + ACTIVE`, `TXN ACTIVE - Rs 100`, `INACTIVE` stay distinct).
3. Components: web `<StageBadge/> <DecisionBadge/> <ActivationBadge/>` + `<ProvenanceChip/>`; mobile equivalents; each badge always renders text; tone from tokens by *known* value class only for visual grouping (e.g. `Decline` danger tone) but unknown values get neutral tone and still show text.
4. Web `LeadsTable` (TanStack) with the §14.2 columns, expandable remarks/bank-KYC panel; mobile `LeadRow` per §14.3.

## Acceptance criteria
- [x] Snapshot tests for all four activation cases in §14.4 and Approve+INACTIVE coexisting.
- [x] No component named or behaving like a fixed progress timeline (VIEW-02).

## Progress notes
- Shared `packages/shared/src/lead-status.ts`: `LeadStatusRow` type, `buildLeadStatusRow()` (pure), `remarksPreview()`, `bankRemarkFields()`, `BANK_REMARK_FIELDS` / `BANK_KYC_FIELDS` (HDFC column names as labels), `LeadAction` (OPEN_DETAILS / ENTER_BANK_REFERENCE / SHARE_APPLICATION_LINK — no "next stage"). Snapshot tests `packages/shared/test/lead-status.test.ts` cover the four §14.4 activation cases and Approve + INACTIVE coexisting.
- API `LeadsService.list/detail` now return the row DTO (`kbsRef`, `customer{name,mobileMasked}`, `bank`, `card{crosswalked}` via `ProductCodeCrosswalk`, `bankApplicationNo/Reference` from the snapshot, `bankCreationDate{value,source}`, `stage/decision/activation` as `StatusField`, `remarksPreview`, `lastMatchedAt`, `actions`); detail adds `bankStatus.raw` (rawLatest) and `bankRemarks{remarks,kyc}`. Blank tokens come from `mis.blankValueTokens`.
- Web `components/leads-table.tsx` (TanStack v8; sortable §14.2 columns; expandable raw panel; React Compiler opted out). Mobile `components/lead-row.tsx` (§14.3 row) used by My Leads; lead detail uses the F-803 badges + provenance chip.
- VIEW-02 guard: `apps/web/test/view-02-no-timeline.test.ts` greps web + mobile UI for timeline/stepper components and auto-advanced stage wording.
