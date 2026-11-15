# F-824 An Advisor's own Agent Code — Advisors who join with it report to that Advisor

Status: DONE (2026-11-15, session 28). Owner request: "one Advisor should be able to give their code to another Advisor,
so the Advisor also earns a share of those leads".
Not in the PRD (REQ-10 §10.4 leaves "who a code may point at" open; codes were limited to Managers and the Admin).
Reverse any rule below by saying so.

## Rules
| Topic | Rule |
|---|---|
| The share | **Settled outside KBS**, like the Manager's share (F-822): the product holds no amount for it. KBS shows the referring Advisor the leads to work it out from. *Engineering assumption — the owner said "earns shares" without saying where it is paid; say if it should be paid through KBS.* |
| Whose code | Every **approved** Advisor can get a code of their own in the app (My team → Get my code): one active code, the same one each time. The Admin can also issue a chosen code to an Advisor, and withdraw any code (People → Agent codes). A code the Admin withdrew is **not** replaced by the Advisor themselves. Managers still get codes from the Admin only; Telecallers have none. |
| Joining | A new Advisor who enters that code at sign-up reports to its Advisor. Changing code later follows the existing rule (Admin approval once the Advisor has leads). The Admin can also move an Advisor under another Advisor. |
| No loops | Nobody can use their own code, or the code of someone below them; the Admin cannot create a loop either. |
| What the referring Advisor sees | **My team**: the Advisors who joined with their code (one level — not those further down), each with their lead count. For each: every lead with full detail — customer, masked mobile and PAN, place, employment, income, card, bank application number, the three bank fields, bank history, KBS activity. **Read-only**: no reference entry, remarks, follow-ups or link sharing on someone else's lead. **No amounts**: no payout figure on the lead, no access to the other Advisor's earnings or requests. Their own lead list is unchanged. A notice arrives when a team member creates a lead. |
| Who else sees | Not other Advisors, and not upwards (a team member cannot read the referring Advisor's leads). The **Manager above the line sees everyone below it** (their team is now multi-level), with "reports to …" on each row. |
| Payout approval | Unchanged in kind: the Manager step goes to the **nearest Manager above the line**, however many Advisors are in between; if the line ends at the Admin, the designated Manager approver. The referring Advisor never approves and cannot see the request. |
| Who is paid | Only the Advisor who created the lead. Nothing is credited to the referring Advisor. |

## Where
- **API.** `AGENT_CODE_SELF` permission; `POST /me/agent-codes`, `GET /me/team`; `AgentCodesService` (Advisor owners, `createOwn`, `myTeam`, `assertNoLoop` on apply / approve / reassign); `HierarchyService` (`directReportIds`, multi-level `teamUserIds`, `ancestorIds`, `nearestManagerId`); `Actor.referralUserIds` (kept apart from `teamUserIds` so it grants lead reading and nothing else); `LeadsService` (`advisorId` for an Advisor = a direct team member, `assertCanAnnotate`, amounts hidden in that view); MIS history and notification targets follow the same read rule; payout approver resolution.
- **App.** Advisor Home and Profile → **My team** (`team.tsx`: code + share, team list) → an Advisor's leads (`team-advisor.tsx`) → read-only lead (`team-lead.tsx`, shared `components/lead-readonly.tsx` with the Manager's lead screen).
- **Web.** Admin → Agent codes can issue to Advisors; Admin → user page can move an Advisor under another Advisor; Manager → Advisors shows "reports to …".

## Checks
API e2e `hierarchy` F-824 case; UAT-01 S18 (40 API checks), S19 (7 web pages), S20 (2 app flows). Full UAT-01 run from a
fresh database: 453 / 453. Found on the way and fixed before release: remarks and follow-ups checked read access only, so
the referring Advisor could have added them to a team member's lead (`assertCanAnnotate`).
