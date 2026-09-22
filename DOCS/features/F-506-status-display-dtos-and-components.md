# F-506 Status display: DTO shaping, web table, mobile row, badges

- Group: MIS · Status: **PLANNED** · Depends on: F-505, F-803
- PRD refs: REQ-14 §14.1 (no fixed state machine; independent fields), §14.2 (table columns and source rules), §14.3 (mobile row layout; full details; never one overloaded chip), §14.4 (activation display table; Approve + INACTIVE coexist; card setup ≠ activation), §14.5 (remarks grouping; operational remarks separate), REQ-20 §20.2–20.4 ('Not reported' not a dash), REQ-13 §13.6
- QA ids: VIEW-01, VIEW-02, MIS-02, MIS-03, MIS-04, MIS-06

## Detailed requirements
1. `LeadStatusRow` DTO (shared schema): customer (masked), bank/card (+ crosswalked catalogue card if mapped), kbsRef, bankApplicationNo, bankApplicationReference, leadCreatedAt, bankCreationDate (with which column it came from), `stage`, `decision`, `activation` as `StatusField` objects (F-004), remarksPreview (first non-blank of the grouped reason fields, truncated), lastMatchedAt, actions.
2. `bankValueDisplay` rules: never matched → "Awaiting MIS Update"; matched but blank → "Not reported"; else raw text verbatim (`V + ACTIVE`, `TXN ACTIVE - Rs 100`, `INACTIVE` stay distinct).
3. Components: web `<StageBadge/> <DecisionBadge/> <ActivationBadge/>` + `<ProvenanceChip/>`; mobile equivalents; each badge always renders text; tone from tokens by *known* value class only for visual grouping (e.g. `Decline` danger tone) but unknown values get neutral tone and still show text.
4. Web `LeadsTable` (TanStack) with the §14.2 columns, expandable remarks/bank-KYC panel; mobile `LeadRow` per §14.3.

## Acceptance criteria
- [ ] Snapshot tests for all four activation cases in §14.4 and Approve+INACTIVE coexisting.
- [ ] No component named or behaving like a fixed progress timeline (VIEW-02).
