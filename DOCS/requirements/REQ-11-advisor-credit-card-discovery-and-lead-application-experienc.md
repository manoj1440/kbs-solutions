<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 11. Advisor credit-card discovery and lead/application experience

## 11.1 Business flow (corrected)

**Onboard and log in -> browse/search/filter cards -> inspect card and
available pincode sourcing -> select card -> create customer
operational lead -> verify/collect customer information and
declarations -> review -> record lead reference -> share/open
Admin-managed bank application link -> await/display bank-reported MIS
status and remarks -> act on a genuinely reported issue if relevant ->
request payout only when the appropriate activation event is confirmed
in MIS.** This is a user interaction sequence, **not a predefined bank
status timeline**.

## 11.2 Credit Card Home

Show card search/discovery entry, Create Lead, My Credit Card Leads,
Pending Actions based on actual actionable information, MIS/status
updates, own activated cards and payout access. Display high-level
counts by their correct provenance, e.g., total operational leads vs
MIS-confirmed activated cards. Make navigation suitable for field use
and avoid claiming all leads are 'processing' by default.

## 11.3 Catalogue, categories and details

Browse Admin-published card catalogue; filter by category (Travel,
Shopping, Premium/Top, Fuel, other), card/issuer and relevant
fees/benefit/location attributes. Detail displays image, bank, category,
key features/rewards/benefits, joining/annual fees, major relevant
charges, high-level eligibility/disclosures, benefit PDF and **Create
Lead / Apply for Customer** CTA. Category labels and any marketing
phrases must not imply guaranteed bank approval. Pincode sourcing is
location availability, not a credit eligibility result.

## 11.4 Create customer lead — exact captured fields

Customer mobile number -> basic customer details/name -> PAN entry and
verification state -> current residence pincode and confirmed
city/state -> employment choice **Salaried / Self Employed / Self
Employed Professional** -> annual income as per ITR -> required
customer declarations, Credit Bureau acknowledgement and applicable
consent -> review all values and selected card -> submit. Show
step-level error/return-to-edit, maintain selected card throughout,
avoid unnecessary duplicate customers and create a KBS operational lead
reference on successful internal submission. PAN verification
method/provider, allowed manual fallback and whether the customer or
Advisor enters each item are **OPEN** integration/policy decisions.

## 11.5 What 'lead created' means

On internal lead submission, show success, KBS lead/reference, customer,
selected credit card, issuer and the immediate available action
(share/open application link, View Lead, Create Another Lead, My Leads
or Home). This proves only that a KBS operational lead exists. It **does
not** prove that the bank has created, accepted, submitted, approved or
activated an application.

## 11.6 Bank application link initiation

From the saved lead, the Advisor selects **Share application link** or
an equivalent customer-approved way to open the Admin-approved issuer
link. Preserve tracking parameters and link version; associate
sharing/open initiation events with the Advisor, customer, selected card
and KBS lead. Where an issuer returns an application number by an
explicitly supported and permitted mechanism, record it; otherwise show
'Bank application reference not yet available' and match when a reliable
reference is later obtained. Do not call a link share 'Application
Submitted' or infer bank status from a redirect. **OPEN:** how bank
reference is captured for each issuer if not returned in shared link
flow; this is required for deterministic MIS matching.

## 11.7 Eligibility results and 'no-result' states

The earlier FOS draft requests an eligibility/card-result screen 'where
applicable'. Preserve it **only for validated, actually available
sourcing/eligibility information** from Admin-managed data or a
separately approved lawful customer-verification process; do not invent
eligibility from pincode, initial lead creation or link opening. If a
bank-specific approved eligibility result is unavailable, show that no
confirmed eligibility result is available; allow the customer to proceed
only through the bank's intended application journey. Distinguish 'no
card sourceable at this pincode', 'no eligibility result available', and
a bank-reported decline in MIS.

## 11.8 My Leads, search and filters

Advisor must have a single My Credit Card Leads area with assigned
customer/card/issuer, KBS lead reference, bank application/reference (if
known), creation date, **CURRENT_STAGE**, **FINAL_DECISION**, **Card
Activation Staus**, relevant actual bank remarks and most recent
matching MIS upload date. Search by customer name, mobile and reference;
filter by issuer/card, date, bank stage, decision, activation, MIS
freshness and actionable customer/Advisor tasks; sort by relevant
date/status. Show only Advisor-owned leads according to accepted
attribution rules.

## 11.9 Lead details, next action and history

Lead detail combines (A) customer/selected card and operational events,
(B) matched bank references and latest actual MIS values, (C)
MIS-sourced remarks, and (D) payout eligibility/payment only when
applicable. **Do not display a fictional ordered bank timeline.**
Instead show a chronological **MIS update history** with the exact
status values seen on each upload and the upload time; use reported
event dates only if supplied. If the MIS identifies a real
customer/Advisor requirement (for example document curing or KYC issue),
show the reported detail and an actionable next step only if there is a
verified route to act. Operational tasks manually entered in KBS are
separately labelled 'Follow-up task', not MIS status.

## 11.10 Pending Actions and notifications

A Pending Actions view groups concrete tasks with customer/card/issuer,
owning party, what to do, source (MIS field or KBS operational task),
date and permitted CTA. Do not produce a task merely because a row has
no MIS status or a generic 'Inprocess' value. If source data does not
identify an owner or remedy, show the actual bank text without inventing
who must act. From the notification, navigate to the correct lead and
its current data. KBS announcements may be shown distinctly from MIS
alerts.

## 11.11 Advisor profile and support

Profile shows name, registered mobile, email, identity-verification
summary, reporting relationship/Agent Code, bank payout-details summary
(masked), support/help and logout. Allow Advisor to submit a code later
under an auditable, agreed effective-date policy. Sensitive
identity/cheque files must not be exposed in generic profile cards or
notifications.
