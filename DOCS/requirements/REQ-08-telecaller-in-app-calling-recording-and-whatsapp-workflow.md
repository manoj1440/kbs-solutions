<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 8. Telecaller in-app calling, recording and WhatsApp workflow

## 8.1 Call-screen design and interaction sequence

Telecaller opens assigned customer -> sees customer summary and
pincode-matched card choices -> taps **Call** -> the call is placed
using a business telephony solution integrated with the app -> status
of call establishment appears without hiding the customer's card details
-> Telecaller may expand a card and use WhatsApp share actions from the
same screen -> after the interaction, Telecaller records call result,
selected/shared card, notes and follow-up or hide action -> the
Manager/Admin sees the full activity trail and recording when one is
available. An internet-hosted business telephony/call-bridging service
may be used; the PRD does not promise unrestricted native PSTN call
recording from a standard Android third-party app.

## 8.2 Telephony functional requirements

> **•** Start an outbound call **from the app's Call action**; associate
> call ID, calling Telecaller, assigned customer, target number,
> initiated time, provider result, connect/end time if reported and
> duration with one activity.
>
> **•** Provide comprehensible states such as requesting connection,
> ringing (if provider supports), connected, ended, failed, no answer
> and recording available/unavailable; distinguish provider-confirmed
> state from user-selected outcome.
>
> **•** Recording should be initiated automatically through the selected
> authorized telephony provider when legally and technically available;
> expose playback to assigned Manager and Admin under access policy and
> keep recording linked to the correct call/customer.
>
> **•** If call initiation or recording fails, show the failure and
> permit a safe retry; never show 'Recorded' unless a retrievable
> recording exists. Avoid duplicate attempts caused by a double tap.
>
> **•** The recording architecture/provider, per-minute costs,
> concurrent-call capacity, number masking/caller ID, consent
> disclosure, recording retention, retrieval fees and uptime support are
> **OPEN provider-selection decisions**. Select on total cost and
> reliable recording, not just headline per-minute price.

## 8.3 Customer context retained on the calling screen

Show name, masked/mobile number as role permits, pincode, location if
verified, assigned Telecaller, recent activity and follow-up status; a
card list filtered by current pincode mapping; card benefits, applicable
fees, PDF link and application link; call outcome and remarks editor;
share actions for PDF, official ID and card link. Avoid navigating away
from the live calling context merely to see benefits or send
information.

## 8.4 Official Telecaller identity card

Generate an official KBS employee/office ID card at Telecaller account
creation; the purpose is to let a customer identify the person/company
contacting them. The card must be shareable by the user from the
customer call interface. Exact ID-card fields, photo/logo,
expiry/revocation rules and validation method are **OPEN**; do not put
unnecessary PAN, customer data or payout information on it. Regenerate
or revoke its shareable representation on account deactivation as
required by an approved policy.

## 8.5 WhatsApp sharing

Offer distinct **Send benefit PDF**, **Send office ID**, and **Send
application link** actions for the customer's WhatsApp number. Use
Admin-approved current card content/links. Show a clear hand-off/send
result based on the chosen integration: opening a compose/share sheet is
not proof of delivery; provider-confirmed delivery, where available, is
recorded separately. Record who initiated sharing, customer, card,
asset/link version, timestamp and actual known outcome. Where a customer
has not consented to business-initiated WhatsApp messages, follow
approved WhatsApp Business/communications policies rather than silently
sending promotional content. Exact WhatsApp integration method, template
approval, message pricing and media-hosting costs are **OPEN**.

## 8.6 Operational call-outcome taxonomy

Keep Telecaller-entered **operational** outcomes distinct from bank MIS
fields. At minimum support: no answer/unreachable or technical failure;
connected and interested; connected and link/PDF requested/shared;
callback/follow-up needed; customer declined/not interested; completed
interaction/no further calling; and optional remarks. The Admin may
refine the operational taxonomy without creating bank application-stage
values. Require a reason/notes when choosing follow-up/declined if
configured. Hide declined/completed rows from the active call queue but
do not delete them. A customer request not to be contacted must be
enforced as a suppression, including across new imports.

## 8.7 Telecaller 'lead' terminology and attribution

The original requirements mention that Telecallers can create leads when
sending a credit-card link, but later clarify that Telecallers are
salaried and should not own Advisor-like commission leads. Implement an
**operational calling lead/interest record** tied to customer, card,
link and Telecaller activity, usable for Manager/Admin performance
analysis and later MIS matching where KBS receives a reliable reference.
It does not grant card payout to the Telecaller and does not create an
invented bank status. If an Advisor later submits a separate
commission-bearing application for the same customer, attribution and
collision rules require **OPEN** business definition; do not
double-count the application.
