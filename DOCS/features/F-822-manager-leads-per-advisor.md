# F-822 Manager: every lead per Advisor, with full detail

Status: DONE (2026-11-15, session 28). Owner decision on UAT-01 finding F-1.

## Decision (owner, 2026-11-15)
A Manager does earn a share when their Advisor is paid, but **the amount is agreed and settled outside KBS**. The product
does not hold a Manager rate, ledger or payout. What the Manager needs from KBS is the evidence to work it out:
**the leads of each Advisor, with all lead details.** Nothing else is to be built for this.

Later the same day the owner added F-823: a Manager may also create leads themselves and is paid for those through KBS.
That does not change this decision — an Advisor's card still never credits the Manager in KBS.

## What the Manager has
| Where | What |
|---|---|
| Web → Team leads | **Advisor column** on every row and an **Advisor filter** (the Manager's own Advisors). With an Advisor chosen, the six tiles show that Advisor's figures (leads, approved, declined, in process, cards active, awaiting). |
| Web → Advisors → an Advisor | "Leads · N" with the latest ten and "All N leads" → the filtered list above. |
| Web → a lead | The Advisor's name (links to the Advisor page), customer, masked mobile and PAN, PAN check, place, employment, income, card, bank application number, the three bank fields, every bank column, bank history, KBS activity, follow-ups, payout position. |
| App → Advisors → an Advisor | "Leads · N" with the real total and **Show more leads** (20 at a time) — it used to stop at 20. |
| App → a lead | Advisor's name, PAN check, employment, annual income and "Advisor payout for this lead" added to what was there. |

The Admin gets the same Advisor column and filter on Admin → Leads (all teams).

## Changes
- API: `LeadStatusRow.advisor` (id, name, ref) on list and detail; `GET /leads/filters` returns `advisors` (scope-aware,
  empty for an Advisor); `GET /leads/summary?advisorId=` (a Manager asking outside their team gets zeros);
  lead detail `payouts[].request.cardCount`.
- Wording fix found on the way: a paid amount on a lead is the **request's** amount. Two leads paid in one ₹3,000.00
  request each read "₹3,000.00" on the Advisor's lead screen. It now reads "₹3,000.00 for 2 cards".
- Web: `leads-browser.tsx`, `leads-table.tsx`, `lead-detail.tsx`, Manager Advisor page. App: `(manager)/advisor.tsx`,
  `(manager)/lead.tsx`, `(advisor)/lead.tsx`.

## Not changed
No Manager amount anywhere. Team scoping is as before: a Manager sees only Advisors who report to them now (UAT-01 O-2).
Mobile and PAN stay masked for everyone.

## Checks
API e2e `leads-list` F-822 case; shared lead-row snapshots; UAT-01 S10-V-01…10, S13-M07…M10 (web), app flow
`manager-m1` (Advisor → lead → details). Full UAT-01 run: 354 / 354.
