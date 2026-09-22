<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 1. Product summary, objectives and success measures

## 1.1 Product statement

KBS operates an existing DSA business and needs one credit-card-only
sales-and-operations system comprising an Android mobile app and a web
administration application. It coordinates customer calling, available
bank/card products by pincode, Advisor field sales, lead attribution,
bank MIS imports, administrative analytics and manually disbursed
Advisor payouts. There is one company-owner Admin role; Managers
supervise teams, Telecallers work salaried calling lists, Advisors
create bank-linked customer applications, and Accounts executes approved
payments outside KBS while recording proof inside KBS.

## 1.2 Business outcomes

Give Telecallers an efficient, auditable calling desk; make card/pincode
details and WhatsApp material available within the call workflow; let
Advisors discover cards, start customer applications and see actual bank
MIS results; give Managers and Admin an accurate operational and
bank-results view; allow Advisors to claim eligible activated-card
payouts with dual approval and nonduplicating settlement records;
protect confidential data and avoid false claims based on incomplete
bank MIS.

## 1.3 Measures and definitions

Measure imported vs assigned vs actioned calling records; attempts,
connected calls, no-answer/failed calls, follow-ups, declines, links
shared; Advisor-created leads and shared/initiated applications; bank
MIS-matched cases, stage distribution, final-decision distribution and
activation distribution; activated cards eligible for payout, reserved
in requests, approved, paid and outstanding. Always show the date range,
population, relevant MIS recency and data provenance. **Never** present
a completed call, sent link or bank approval as an activated card. Exact
commercial targets, conversion thresholds and performance policies are
outside this PRD unless configured later by KBS.
