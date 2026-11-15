# F-823 A Manager also sells — same lead flow as an Advisor, paid through KBS

Status: DONE (2026-11-15, session 28). Owner decision: "the Manager should be able to create leads, same flow as an
Advisor" → paid **through KBS** (owner chose this over settling outside).
Not in the PRD (REQ-03 / REQ-15 give the Manager supervision only) — this is an owner extension. Reverse any rule below by saying so.

## Rules
| Topic | Rule |
|---|---|
| Who | Every Manager. Telecallers, Accounts and the Admin still cannot create leads. |
| Before selling | The Manager gives the same details as an Advisor — name + email, consent, identity check, bank account, cancelled cheque — and the **Admin approves them**. No Agent Code step (a Manager reports to the Admin). Until then "My sales" opens those steps; **team work is never blocked** (the gate is `required: false`). |
| Leads | The same eight steps, same checks (PAN, card available at the pincode, declarations, duplicate mobile). The lead belongs to the Manager; its reporting person is the Admin. The apply link carries the Manager's own code. |
| Bank file | Unchanged. An activated card on the Manager's own lead becomes one claimable card for the Manager. |
| Payout approval | **No Manager step.** Nobody approves their own request and a Manager reports to the Admin, so the Admin alone approves and sets the amount; then Accounts pays into the Manager's verified account with reference + proof. Stored with the requester as "Manager approver" (`noManagerStep`) — no schema change. |
| What the Manager is paid for | Only cards from leads **they created**. An Advisor's card is never the Manager's to claim — the Manager's share on Advisors' cards stays outside KBS (F-822). |
| Who sees what | The Manager: own leads in "My sales"; own + team in Team leads (each row names its owner). Other Managers and the team's Advisors cannot open a Manager's lead. The Admin sees all, owner marked "Manager". |
| Totals | A Manager's own sales count **with their team** (Manager dashboard, Admin → Managers row) and the Manager is a row of their own in their Advisors table and in Admin → Advisors (only once they have a lead). The "Advisors" head-count still counts Advisors only. |

## Where
- **API.** `ROLE_PERMISSIONS.MANAGER` gains the selling permissions; `GatesService.onboarding` (Manager: never required, `complete` = payee profile approved); `PolicyGuard` blocks a Manager's non-GET selling calls until then; `OnboardingService` (profile created on first use, cheque → review, activation leaves the Manager's status alone); `LeadsService` / `PendingActionsService` / payout scopes take `own=1` (the caller's own data — a Manager's default scope is team + own); `PayoutRequestsService` (`noManagerStep`, `managerStepRequired` in the view, Admin "awaiting me" includes it at once, the Manager's own list never does); dashboards (`selfSellerId`, approval counters).
- **App.** Manager home → **My sales** → the Advisor screens (Home, Leads, New lead, Cards, Earnings) on their own data, with **Back to team**. First use → "Your details to sell cards" (the onboarding steps without Agent Code).
- **Web.** Leads tables and lead pages name the owner (with "Manager" when it is one); payout request page shows "no Manager step" and a four-step journey; Admin → Advisor approvals marks "Manager · wants to sell cards". Lead creation stays app-only, as for Advisors.

## Checks
API e2e `payout-requests` F-823 case; UAT-01 S15 (39 API checks), S16 (9 web pages), S17 (2 app flows). Full UAT-01 run from a
fresh database: 404 / 404.
