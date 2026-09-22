# F-409 Pending Actions and operational follow-up tasks

- Group: Advisor · Status: **PLANNED** · Depends on: F-408, F-701
- PRD refs: REQ-11 §11.10 (group concrete tasks with owner/what/source/date/CTA; no task from blank or generic 'Inprocess'; show bank text without inventing owner), §11.9 (actionable next step only with verified route), REQ-12 S23, REQ-14 §14.5 (mismatched remarks must not trigger made-up CTA)
- QA ids: VIEW-03

## Detailed requirements
1. Task sources: (a) `FollowUpTask` explicitly created by the Advisor/Manager (source KBS_OPERATIONAL, owner set); (b) MIS-derived *informational* items generated only by configured rules `mis.actionableRules[]` (per bank: field + value pattern → label + owner + optional CTA); default seed has **no** rules, so no MIS-derived tasks exist until Admin configures them with a verified route.
2. `GET /pending-actions` → items `{leadRef, customer, card, issuer, owner, whatToDo, source: MIS_FIELD(field,batchRef)|KBS_TASK, date, cta?}`.
3. Bank text shown verbatim when a rule matches but defines no owner ("Bank reported: <text>").

## Acceptance criteria
- [ ] VIEW-03: lead with `FINAL_DECISION=Inprocess` and blank reasons → zero pending actions; explicit follow-up task → one item with owner.
