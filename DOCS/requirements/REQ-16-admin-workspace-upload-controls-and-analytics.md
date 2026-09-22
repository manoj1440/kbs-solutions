<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 16. Admin workspace, upload controls and analytics

## 16.1 Organization-wide operations

One Admin/owner oversees all Managers, Telecallers, Advisors and
Accounts users; training content/MCQs/thresholds; calling list and
auto-assignment; office network/WFH controls; bank pincode mapping and
card catalogue; official ID design; benefit PDFs and links; MIS files
and import exceptions; operational call data/recordings; leads and real
MIS status; payout requests, approvals, payment proofs, reconciliation
and audit records. Expose upload logs, unmatched MIS cases, prohibited
contact records and configuration versions.

## 16.2 Admin dashboard collection

| **Dashboard**                   | **Required tiles, charts and drill-down**                                                                                                                                                                               |
|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Executive overview              | New operational leads, bank-matched cases, bank decision distribution, confirmed activation categories, eligible-card counts, payouts requested/approved/paid; date range and latest per-bank MIS freshness visible.    |
| Telecaller performance          | Upload and allocation batches; total/connected/failed/no-answer calls; unique contacted customers; connected-to-interest and follow-up outcomes; links/PDF/ID shared; recordings available; team/individual drill-down. |
| Manager performance             | Team staffing/training, WFH grants, calling results, Advisor lead volume, MIS decision/activation values and pending dual approvals, by reporting line.                                                                 |
| Advisor performance             | Registered/verified Advisors, own generated leads, unmatched/matched references, actual MIS stage/decision/activation, eligible/reserved/paid payout cards, lead-level detail.                                          |
| Bank/card mix                   | Lead count and actual MIS bank stage/decision/activation by issuer, card, period, channel and pincode where reliable; don't infer card approval from sourceability.                                                     |
| MIS integrity and freshness     | Per-bank last upload, last matched updates, number of rows imported/matched/unmatched/invalid/conflicted, new enums, row/key duplicates and corrections requiring review.                                               |
| Payout liability and settlement | Eligible vs reserved vs approved vs paid card events, request aging, dual-approval backlog, external transfer records, missing proof and exceptions.                                                                    |
| Data and permissions audit      | User management changes, training/WFH changes, sensitive-data access, changed catalogue/link versions, MIS corrections and payout changes.                                                                              |

## 16.3 Metric formulas and guardrails

> **• Call attempts:** count distinct provider-confirmed outbound
> attempts within time filter; separately report user-initiated attempts
> that failed before provider connection.
>
> **• Connected calls:** count distinct provider-confirmed connected
> calls where provider data supports it; never infer connection from
> saved remarks.
>
> **• Unique customers contacted:** distinct assigned customer IDs with
> confirmed connected calls in period.
>
> **• Link shares:** count distinct recorded share actions; actual
> delivered messages only when a delivery status exists.
>
> **• Leads created:** count distinct KBS lead IDs created in period;
> split by Advisor/operational Telecaller lead category.
>
> **• MIS-matched leads:** count distinct lead IDs with at least one
> accepted and reliable bank MIS linkage; show unmatched leads
> separately.
>
> **• Bank stage/decision/activation counts:** per latest accepted
> **matching** MIS value, independently, with 'Not reported' and
> 'Awaiting MIS' categories.
>
> **• Activation payout eligible:** count unique card events satisfying
> bank-specific approved rule based on MIS, minus neither duplicates nor
> already-paid records; distinguish eligibility count from
> available-to-claim count.
>
> **• Available claim count:** eligible unique card events minus those
> reserved in active request(s) and those already paid for the same
> entitlement.
>
> **• Paid payout amount:** amount recorded as externally paid by
> Accounts with supporting transaction proof; distinguish
> approved-but-unpaid amount.

For period-based reports, label whether filtering by KBS lead date,
source MIS reporting event date, MIS upload date or Accounts paid date.
Never mix denominators or imply a value reflects live bank status beyond
the latest imported MIS.
