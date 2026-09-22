<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 15. Manager workspace and requirements

## 15.1 Team management

Manager has a mobile and web workspace. Create Telecaller (name + mobile
only), view training/assessment progress and remaining 72-hour deadline,
reactivate failed Telecallers from the uncleared module, enable/revoke
selected Telecaller WFH exceptions, review team allocations, follow-ups,
customer declines, card materials shared, attempts and call recordings.
View Advisors assigned through reporting code, their lead/MIS results
and payout requests. Never assign a Telecaller from another Manager
without an authorized, logged reassignment.

## 15.2 Manager dashboard datasets

Show filters by date, Telecaller, Advisor, bank, card, pincode/location
and current MIS recency where relevant; present counts for customer
records uploaded/assigned/active/hidden, calls attempted/connected/not
answered/failed, callbacks due/completed, customer-interest outcomes,
links/PDFs/IDs shared and recording coverage (where provider confirms).
Advisor metrics include own team leads created, application references
matched in MIS, distribution of CURRENT_STAGE and FINAL_DECISION,
distinct activation statuses, actionable bank reasons, payout-eligible
cards, requested, approved and paid amounts. Show denominator and source
so connected calls cannot be confused with bank activations.

## 15.3 Performance review

Manager and Admin can drill down to a Telecaller's detailed attempts,
call dates, customer outcomes, recordings and remarks to evaluate
operational efficiency. Advisor view drills down to each eligible
card/lead, bank result and payout history. **No automatic employment or
termination decision**, hidden ranking or unexplained score is
authorized by the source requirements; present evidence and configurable
reporting only.

## 15.4 Approval and notifications

Receive Advisor payout requests within the Manager's hierarchy; inspect
linked MIS-eligible card events and amounts, approve/reject with
recorded reason according to policy, see Admin approval and Accounts
payment outcome. Where Advisor belongs directly to Admin, route the
required Manager approval through a specifically designated independent
Manager role per a confirmed KBS policy (**OPEN**), not an automatic
skipped approval or double-counting of Admin's own approval.
