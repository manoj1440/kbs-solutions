<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 0. Document authority and interpretation

## 0.1 Purpose and sources

This PRD consolidates the business requirements supplied for KBS's
credit-card-only DSA solution, the later user-requested corrections on
Excel-only bank status and shadcn/ui, and inspection of three uploaded
workbooks: 10_records_each_bank(1).xlsx,
KBS804%20HDFC%20MIS_recreated(1).xlsx, and
offline_cards_20_jaipur_pincodes(1).xlsx. The narrative source is Pasted
text.txt. The example worksheets demonstrate formats, **not** a complete
production data contract or verified live bank partnership.

## 0.2 Precedence of requirements

Where early text conflicts with a later explicit decision, the latest
decision governs: (1) shadcn/ui replaces the earlier Tamagui request;
use a compatible native design implementation on React Native rather
than attempting to run DOM-based web components natively; (2) bank
status and remarks come only from uploaded MIS files, superseding
assumptions of third-party status APIs and the previously proposed fixed
FOS status progression; (3) the Advisor creates an operational lead and
starts/shares an issuer link, after which bank status comes from MIS;
(4) 72 hours from first Telecaller login replaces ambiguous 'three
days'; (5) failed training resumes at the uncleared module after Manager
reactivation; (6) Android APK is the first mobile release and iOS is not
in scope; (7) both Manager and Admin approvals are required for an
Advisor payout; (8) all card activation and payout accounting is
MIS-driven.

## 0.3 Requirement labels

> **• MUST:** mandatory agreed business behaviour.
>
> **• SHOULD:** recommended implementation detail that supports the
> original requirement without inventing new business policy.
>
> **• OPEN / REQUIRED BEFORE BUILD:** a missing contractual, policy or
> configuration value that cannot be safely assumed.
>
> **• MIS status:** bank-reported information only; **operational
> state:** events recorded in KBS, such as a link shared or call
> completed; **payment state:** request/approval/paid history maintained
> within KBS.

## 0.4 Core invariants (INV)

> **• INV-01:** No KBS action, bank website redirect, link click,
> telephony event, user note or payout action independently sets a
> bank-reported status, KYC outcome, final decision or activation value.
>
> **• INV-02:** The application preserves each original bank MIS value
> and can show an optional clearly identified display label; blank/#N/A
> is unknown, not success, failure or inactive.
>
> **• INV-03:** Bank application stage, final decision and card
> activation are separately named and separately displayed; approval is
> not activation.
>
> **• INV-04:** Latest valid, correctly matched MIS values are reflected
> in all authorized views and derived figures; history of prior reported
> values is retained.
>
> **• INV-05:** An operational Telecaller lead/interaction does **not**
> create a Telecaller card-commission entitlement; Advisor-owned leads
> and Advisor payout entitlements are separately attributed.
>
> **• INV-06:** A single payable card event cannot be present in two
> simultaneous payout claims or paid twice. Paying a claim does not
> itself change the bank's card activation status.
>
> **• INV-07:** Hiding a customer from an active queue never deletes the
> history, uploaded source reference or permitted audit trail.
>
> **• INV-08:** An unmatched MIS row must not be silently linked to a
> similar name/mobile or change another customer's lead.
>
> **• INV-09:** Office Wi-Fi restrictions and explicit WFH exceptions
> apply to Telecallers, **not** Advisors.
>
> **• INV-10:** No functionality should claim guaranteed approval,
> eligibility, delivery of WhatsApp content, or automatic call recording
> if a provider has not confirmed the event.
