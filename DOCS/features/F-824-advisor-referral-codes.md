# F-824 An Advisor's own Agent Code — Advisors who join with it report to that Advisor

Status: DONE (2026-11-15, session 28; share paid through KBS added the same day). Owner request: "one Advisor should be able to give their code to another Advisor,
so the Advisor also earns a share of those leads".
Not in the PRD (REQ-10 §10.4 leaves "who a code may point at" open; codes were limited to Managers and the Admin).
Reverse any rule below by saying so.

## Rules
| Topic | Rule |
|---|---|
| The share | **Paid through KBS** (owner decision, 2026-11-15 — replaces the first version, which settled it outside). When the bank reports a card activated on a lead, the Advisor that lead's Advisor **reported to when the lead was created** gets a payable item of their own on the same card: a **referral share**. It is separate from the card's own payout — a different payee, its own request, its own amount. |
| How the share is paid | Exactly like any card: it appears in the referring Advisor's **Earnings** as claimable ("Team share · lead of …"), they request it, **their own** Manager approves, the **Admin sets the amount** when approving (no fixed rate or percentage in the product), Accounts pays with proof. It can be requested alone or together with their own cards. |
| Who gets one | **One level only, and an Advisor only.** Bina joined with Arjun's code → Arjun has a share on Bina's cards. Chetan joined with Bina's → Bina has a share on Chetan's; Arjun has none. If the lead's Advisor reported to a Manager or the Admin, there is no share in KBS (a Manager's share stays outside, F-822). |
| Fixed at lead creation | The payee is whoever the Advisor reported to on the day the lead was created. Moving the Advisor to someone else later changes neither the payee nor the payee's access to that lead. |
| Bank reversals | The share follows the bank like the card's own payout: activation taken back → both go **Under review**; active again → both return (back into their request if they were in one). A reversal after payment raises the same exception for Accounts. |
| Whose code | Every **approved** Advisor can get a code of their own in the app (My team → Get my code): one active code, the same one each time. The Admin can also issue a chosen code to an Advisor, and withdraw any code (People → Agent codes). A code the Admin withdrew is **not** replaced by the Advisor themselves. Managers still get codes from the Admin only; Telecallers have none. |
| Joining | A new Advisor who enters that code at sign-up reports to its Advisor. Changing code later follows the existing rule (Admin approval once the Advisor has leads). The Admin can also move an Advisor under another Advisor. |
| No loops | Nobody can use their own code, or the code of someone below them; the Admin cannot create a loop either. |
| What the referring Advisor sees | **My team**: the Advisors who joined with their code (one level — not those further down), each with their lead count. For each: every lead with full detail — customer, masked mobile and PAN, place, employment, income, card, bank application number, the three bank fields, bank history, KBS activity. **Read-only**: no reference entry, remarks, follow-ups or link sharing on someone else's lead. On the lead they see **only their own share** (its state, and its amount once paid) — never the other Advisor's payout, earnings or requests. Their own lead list is unchanged. Notices arrive when a team member creates a lead and when a share becomes claimable. |
| Who else sees | Not other Advisors, and not upwards (a team member cannot read the referring Advisor's leads). The **Manager above the line sees everyone below it** (their team is now multi-level), with "reports to …" on each row. |
| Payout approval | The Manager step goes to the **nearest Manager above the payee**, however many Advisors are in between; if the line ends at the Admin, the designated Manager approver. This holds for a card's own payout and for a share. An Advisor never approves, and neither side can see the other's request. |
| Who is paid | The Advisor who created the lead (card payout) and, when they joined under another Advisor, that Advisor (referral share). Admin and Accounts see both on the lead, each with the payee's name. An earlier request for the card's own payout is not flagged as a repeat on the share's request, or the other way round. |

## Where
- **API.** `AGENT_CODE_SELF` permission; `POST /me/agent-codes`, `GET /me/team`; `AgentCodesService` (Advisor owners, `createOwn`, `myTeam`, `assertNoLoop` on apply / approve / reassign); `HierarchyService` (`directReportIds`, multi-level `teamUserIds`, `ancestorIds`, `nearestManagerId`); `Actor.referralUserIds` (kept apart from `teamUserIds` so it grants lead reading and nothing else); `LeadsService` (`advisorId` for an Advisor = a direct team member, `assertCanAnnotate`, amounts hidden in that view); MIS history and notification targets follow the same read rule; payout approver resolution.
- **App.** Advisor Home and Profile → **My team** (`team.tsx`: code + share, team list) → an Advisor's leads (`team-advisor.tsx`) → read-only lead (`team-lead.tsx`, shared `components/lead-readonly.tsx` with the Manager's lead screen).
- **Web.** Admin → Agent codes can issue to Advisors; Admin → user page can move an Advisor under another Advisor; Manager → Advisors shows "reports to …".

- **Paid share.** `PayoutEntitlement.kind` (`OWN` \| `REFERRAL`, migration `20261115160000_referral_entitlement_kind`, additive); `EligibilityService.ensureReferral` creates it with the activation, payee = `Lead.reportingParentUserIdSnapshot` when that user is an Advisor; ledger rows, request items and the entitlement list carry `kind` and `sourceAdvisor`; lead detail `payouts` is filtered to the viewer for an Advisor and names the `payee`; `common/lead-access.ts` (`holdsShareOnLead`) lets a payee, and the payee's Manager, read the lead whatever the reporting line is today. App: Earnings rows and request items read "Team share · lead of …"; the read-only lead shows "Payouts on this lead". Web: "Referral share · lead of …" on request items and the entitlement ledger; the lead page lists "Card payout · name" and "Referral share · name".
- **Existing data.** Nothing is back-filled. A lead activated before this release gets its share the next time a bank file that reports it active is applied.

## Checks
API e2e `hierarchy` F-824 case and `referral-share` (4 cases: who gets a share, what each person sees, request → approval →
amount with a bank reversal in between, and a later move of the Advisor). UAT-01 S18 (51 API checks), S19 (11 web pages),
S20 (2 app flows). Full UAT-01 run from a fresh database: 468 / 468; API e2e 189. In UAT: Bina's card ₹1,200.00 to Bina,
₹300.00 referral share to Arjun (his earnings ₹3,000.00 → ₹3,300.00), organisation paid total up by exactly ₹1,500.00.
Found on the way and fixed before release: remarks and follow-ups checked read access only, so the referring Advisor could
have added them to a team member's lead (`assertCanAnnotate`); the share's request showed the card's own request as an
"earlier request for the same lead" warning.
