# F-409 Pending Actions and operational follow-up tasks

- Group: Advisor · Status: **DONE** · Depends on: F-408, F-701
- PRD refs: REQ-11 §11.10 (group concrete tasks with owner/what/source/date/CTA; no task from blank or generic 'Inprocess'; show bank text without inventing owner), §11.9 (actionable next step only with verified route), REQ-12 S23, REQ-14 §14.5 (mismatched remarks must not trigger made-up CTA)
- QA ids: VIEW-03

## Detailed requirements
1. Task sources: (a) `FollowUpTask` explicitly created by the Advisor/Manager (source KBS_OPERATIONAL, owner set); (b) MIS-derived *informational* items generated only by configured rules `mis.actionableRules[]` (per bank: field + value pattern → label + owner + optional CTA); default seed has **no** rules, so no MIS-derived tasks exist until Admin configures them with a verified route.
2. `GET /pending-actions` → items `{leadRef, customer, card, issuer, owner, whatToDo, source: MIS_FIELD(field,batchRef)|KBS_TASK, date, cta?}`.
3. Bank text shown verbatim when a rule matches but defines no owner ("Bank reported: <text>").

## Acceptance criteria
- [x] VIEW-03: lead with `FINAL_DECISION=Inprocess` and blank reasons → zero pending actions; explicit follow-up task → one item with owner.

## Progress notes
- Shared `schemas/pending-actions.ts`: `CreateFollowUpTaskBody`, `PendingActionsQuery`, `MisActionableRule` (zod; invalid config entries are ignored + logged), `PendingAction` DTO, `PENDING_CTAS`.
- API `PendingActionsService` (leads module): `POST /leads/:id/follow-ups` (owner = actor, or a team advisor for Manager/Admin; future due date; notifies the owner when assigned by someone else), `POST /follow-ups/:id/done`, `GET /pending-actions?includeDone&leadId` (Advisor: own tasks; Manager: team; Admin: all), `GET/POST /leads/:id/remarks` (entityType `Lead`; edit reuses `PUT /remarks/:id`). MIS-derived items only from `mis.actionableRules` (seeded `[]`): exact regex on non-blank bank text per bank; no owner → `Bank reported: <text>` with no CTA. Follow-ups and remarks also appear in lead detail (`followUps`, `remarks`, `operationalEvents` kinds FOLLOW_UP_TASK / OPERATIONAL_REMARK).
- Web: `components/lead-ops.tsx` on both lead detail pages; `/manager/pending-actions` table. Mobile: `Pending` tab + task/remark section on lead detail. Browser-checked (`scratchpad/lead-ops.png`).
- Tests: `apps/api/test/pending-actions.e2e-spec.ts` (VIEW-03 zero items for Inprocess + blanks; explicit task with owner; rule-driven items incl. informational; remarks separate from bank remarks).
