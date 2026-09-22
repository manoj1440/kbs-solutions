<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 14. Status and remarks presentation (mobile and web)

## 14.1 No fixed bank-state machine

The old proposed visual path Lead Created -> Application Initiated ->
Customer/FOS Action -> Application Submitted -> Under Processing ->
Final Status is **removed as the authoritative bank-status model**.
Those words may appear only as precisely labelled KBS operational events
or actual bank MIS values if a bank has reported them. **Do not**
auto-advance a lead through that sequence, and do not show 'Processing'
simply because a link was shared. Display the latest bank-reported
stage/decision/activation as independent fields.

## 14.2 My Leads and Manager/Admin status table

| **Table column**           | **Source and display rule**                                                                     |
|----------------------------|-------------------------------------------------------------------------------------------------|
| Customer                   | Saved lead customer; mask sensitive fields according to role.                                   |
| Bank / Credit Card         | Saved selected bank/card; supplement with reviewed product code mapping as needed.              |
| KBS Lead ID                | Generated KBS operational identifier, never portrayed as bank reference.                        |
| Bank Application No.       | Application No, where available.                                                                |
| Bank Application Reference | APPLICATION_REFERENCE_NUMBER, where available.                                                  |
| Lead Created Date          | KBS lead creation event; distinct from bank date.                                               |
| Bank Creation Date         | CREATION_DATE_TIME and/or Creation Date with provenance.                                        |
| Current Application Stage  | CURRENT_STAGE, or Awaiting MIS Update when never matched, or Not reported if no value provided. |
| Final Bank Decision        | FINAL_DECISION, shown separately.                                                               |
| Card Activation            | Card Activation Staus, shown separately and with raw bank value accessible.                     |
| Bank Reason / Remarks      | Compact preview with complete field-by-field MIS details in lead view.                          |
| Last Matched MIS Update    | Date/time of newest accepted matching MIS batch, not the global upload.                         |
| Action                     | Open details, actual pending action when supported; no arbitrary 'Move to next stage'.          |

## 14.3 Compact mobile row and full details

Mobile lead row: first line customer and bank/card; second line KBS
reference and bank reference if known; primary badges for **Stage**,
**Decision**, **Activation** as distinct badges even if unknown; last
MIS matched time and a truncated relevant bank reason. Tapping opens
full lead detail: original raw values, KYC substatuses and dates, all
bank remarks, operational history, MIS upload history and authorized
next actions. Web presents the full sortable/filterable table,
expandable reason/details and bulk-free status review. Never replace
multiple bank fields with a single overloaded green/red 'Success/Failed'
chip.

## 14.4 Activation display and payout distinction

| **Raw HDFC Card Activation Staus** | **Display**         | **Interpretation boundary**                                                                             |
|------------------------------------|---------------------|---------------------------------------------------------------------------------------------------------|
| V + ACTIVE                         | V + ACTIVE          | Bank-reported activation value; payout eligibility subject to documented bank-specific commission rule. |
| TXN ACTIVE - Rs 100                | TXN ACTIVE - Rs 100 | Preserve its distinct value; do not silently merge it with V + ACTIVE for payouts.                      |
| INACTIVE                           | INACTIVE            | Not reported active in this field; does not undo a separate approval decision.                          |
| #N/A or empty                     | Not reported        | Unknown/absent, not active, inactive, approved or rejected by inference.                                |

A final bank decision Approve and activation INACTIVE may coexist; show
**both**. CURRENT_STAGE may also reflect card setup without a confirmed
activation value; do not treat card setup as activation. **OPEN:**
whether one or both active-looking values count toward KBS commission
for each bank, and whether a subsequent settlement/hold period applies.

## 14.5 Bank reason and remarks grouping

For HDFC show separate named fields, when available: DROPOFF_REASON,
DECLINE_CODE, DECLINE_DESCRIPTION, Decline Descreption, Decline Type,
and Reason. Additional statuses/notes such as CURABLE_FLAG, KYC Status,
VKYC_STATUS, BKYC Status and relevant expiry dates appear in a detailed
**Bank/KYC information** section; never edit them through an operational
notes field. Telecaller and Advisor may append their own dated
**Operational remarks** with author and edit history. Operational
remarks must not override MIS remarks, and mismatched/unknown remarks
must not trigger a made-up CTA.

## 14.6 MIS change history and alerting

For a given lead, group changes by imported batch; show old->new exact
bank value per changed field, reported bank event date if available, and
KBS import timestamp/uploader. An identical repeat should not create a
fictional stage movement. New notifications should state only the
changed value or confirmed action, e.g., 'Bank MIS updated: Final
decision = Approve; activation = INACTIVE', not 'Your card is activated'
unless the activation field actually confirms the configured event.
Notifications are role-filtered and contain no unnecessary PAN/full bank
account numbers.
