**ANDROID APPLICATION • WEB ADMINISTRATION • EXCEL/MIS-DRIVEN BANK
STATUS**

Version 1.0 \| 22 September 2026 \| Detailed business requirements and
QA acceptance

| **CORE RULE** Only Admin-uploaded bank MIS Excel is authoritative for bank application stage, final decision, activation, KYC and bank remarks. FOS creates an operational lead and initiates a bank link; the system must not invent a bank-stage timeline. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Scope:** Admin • Manager • Telecaller • Advisor (FOS) • Accounts

Source-based details and open launch decisions are explicitly separated.

# Document contents

0\. Document authority and interpretation

1\. Product summary, objectives and success measures

2\. Scope, platforms and release boundaries

3\. Roles, permissions and hierarchy

4\. Global authentication and account lifecycle

5\. Telecaller training: exact flow and rules

6\. Admin customer-list upload and assignment

7\. Bank-specific pincode eligibility and credit card catalogue

8\. Telecaller in-app calling, recording and WhatsApp workflow

9\. Telecaller network restrictions, device controls and training gate

10\. Advisor onboarding, verification and reporting code

11\. Advisor credit-card discovery and lead/application experience

12\. Corrected 29-screen FOS experience map

13\. Bank MIS import — authoritative data contract and processing

14\. Status and remarks presentation (mobile and web)

15\. Manager workspace and requirements

16\. Admin workspace, upload controls and analytics

17\. Activated-card entitlement and complete Advisor payout workflow

18\. Accounts workspace and proof management

19\. Notifications and in-app event routing

20\. UX, visual design and technology constraints

21\. Sensitive information, privacy, calling compliance and recording
safeguards

22\. Conceptual data model and ownership (requirements, not database
design)

23\. Error states, conflicts and recovery paths

24\. Non-functional and operational acceptance requirements

25\. Role-specific screen inventory and navigation

26\. End-to-end cross-role scenarios

27\. Detailed functional acceptance criteria / QA test matrix

28\. Open decisions, dependency owners and launch gates

29\. Requirement traceability checklist

30\. Source inventory and references

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

# 2. Scope, platforms and release boundaries

## 2.1 In scope

Android APK built with React Native; English UI; responsive web
administration/role screens; OTP login; Admin, Manager, Telecaller,
Advisor and Accounts roles; Advisor public registration and verified
onboarding; Telecaller Manager-only creation and 72-hour module
training; Admin customer-list import and automated assignment;
bank-specific pincode import and card catalogue; in-app business calling
and provider-based call recordings; WhatsApp card PDF, company ID and
application-link sharing; operational calling records; Advisor lead
creation and link initiation; imported MIS-based status and remarks;
per-role dashboards, filtering, recording access and notifications;
dual-approval manual payouts; payment proof and auditable histories;
security and access controls.

## 2.2 Out of scope for initial release

Personal loans, home loans, LAP or other financial products; iOS app;
multi-language UI; automatic bank-status or activation checks via
bank/aggregator APIs; automatic card status inferred from visits to bank
websites; in-app money transfer; targets, leaderboards, incentives,
upline commissions, TDS/GST statements and clawback modules. A provider
used for OTP, compliant identity/PAN/bank verification, business
telephony or authorized WhatsApp delivery is **not** a bank-status
integration and may still be needed.

## 2.3 Channel availability

> **• Android mobile:** Telecaller, Advisor and Manager journeys;
> Admin/Accounts mobile functions only if specifically provided and
> appropriately permissioned, otherwise their primary workspace is web.
> The original requirement explicitly grants Managers both mobile and
> web.
>
> **• Web:** Admin control, Manager management/reporting and Accounts
> payout workflow; other role web access only where deliberately
> permitted.
>
> **• Bank website:** the customer completes the external issuer
> application through the Admin-configured bank link. KBS does not claim
> to own the bank's forms, card decision or final application status.

# 3. Roles, permissions and hierarchy

## 3.1 Role definitions

| **Role**              | **Account origin**                                                  | **Data access**                                             | **Main responsibilities**                                                                                                                                        |
|-----------------------|---------------------------------------------------------------------|-------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Admin (company owner) | One company-owner Admin                                             | Organization-wide                                           | All configuration, imports, card content, training, users, teams, analytics, MIS review, payout approval and audit.                                              |
| Manager               | Authorized organizational creation (exact creation permission OPEN) | Own reporting team; broad Admin-approved operational scope  | Create and supervise Telecallers, reactivate training, WFH exceptions, oversee assigned Advisors, review metrics/recordings and approve payouts. Mobile and web. |
| Telecaller            | **Manager only**                                                    | Own assigned calling customers and own operational activity | Complete training; call from app; see pincode cards; share WhatsApp material; record outcomes, follow-up and links. Monthly salary, no card-based payout claim.  |
| Advisor / FOS         | Self-register through app                                           | Own leads, own eligible cards/payouts; own profile          | Identity/bank onboarding, choose card, capture customer details, initiate/share issuer link, review bank MIS status, request payouts.                            |
| Accounts              | Authorized organizational creation (exact creator OPEN)             | Approved payout data and required payee details             | Review approved payment queue, make payment **outside** the application, record payment reference and upload proof. No bank-status edits.                        |

## 3.2 Reporting relationships

A Manager-created Telecaller is assigned to that Manager and cannot see
another Manager's records. An Advisor enters an Agent Code during signup
or later; a valid code attaches the Advisor to its designated
person/Manager. If code is blank, the Advisor belongs under the Admin.
The Advisor's applications and activated-card results are attributed
through that reporting hierarchy. **OPEN:** whether changing/adding an
Agent Code after prior lead creation changes historical lead/payout
attribution, and how an Admin-direct Advisor receives the mandatory
Manager payout approval. Neither rule can be silently presumed;
historical attribution must remain auditable.

## 3.3 Permission safeguards

Permission enforcement must occur server-side as well as in UI, scoped
to organization, reporting line, assignment and record type. A Manager
cannot access unrelated teams, a Telecaller cannot pull the entire
imported customer list, an Advisor cannot see another Advisor's PAN/bank
details, and Accounts cannot alter the MIS. Admin access to sensitive
data must be limited to legitimate function even though Admin has
organization-wide business visibility. Capture
access/edit/export/download activity for sensitive records where
technically feasible.

# 4. Global authentication and account lifecycle

## 4.1 OTP-only authentication

Every role logs in by registered mobile number plus OTP; do not
introduce password/email login as an alternative. Advisor uses the same
mobile/OTP flow to begin signup. Login validates role, activation,
training gate, network restrictions (where applicable),
verification/onboarding completion and session policy before presenting
the role's home screen. All OTP codes must expire, be rate-limited and
never be stored or shown in plaintext after verification. Lost/changed
phone ownership and number reassignment require an Admin-reviewed
recovery process; **OPEN:** specific recovery policy and OTP provider
contract.

## 4.2 Role-dependent first login

> **•** Telecaller: OTP -\> mandatory training or failed/deactivated
> explanation; no calling queue before successful training.
>
> **•** Advisor: OTP -\> personal details, identity verification,
> payout-bank details and optional Agent Code -\> available Advisor home
> when allowed by onboarding policy.
>
> **•** Manager: OTP -\> team workspace on mobile or web.
>
> **•** Admin: OTP -\> organization-wide dashboard and controls.
>
> **•** Accounts: OTP -\> payout queue and payment records.

## 4.3 User lifecycle

Maintain account creation, active, blocked/deactivated and reactivated
events with who/when/why. Preserve assignment history, completed
training, activity and payout records when status changes. Do not let
deactivation erase existing MIS or audit history. **OPEN:** exact
Manager/Advisor/Accounts suspension and recovery authority,
account-retention period and concurrent-session rules.

# 5. Telecaller training: exact flow and rules

## 5.1 Creation and commencement

Only a Manager creates a Telecaller using **name and mobile number**;
the system records the creator as assigned Manager and generates a
company ID card. On first successful OTP login, start a **72-hour
elapsed** training window and present Module 1. The deadline is the
first-login instant plus 72 hours, not three midnight boundaries or
three business days. Subsequent logins do not reset it.

## 5.2 Three sequential modules

Admin alone uploads/maintains the three modules, each including video
content and an MCQ-only assessment (the original 'videos + Q&A'
requirement). Each module is intended for the corresponding training
day, but passing is determined by module completion within the overall
72-hour window. Show training index, current module, video, questions,
assessment results, current score and deadline. Block access to Module 2
until Module 1 passes; block Module 3 until Module 2 passes; block the
customer calling queue until all three pass.

## 5.3 Passing logic

Calculate assessment marks from correct MCQ answers and the
Admin-configured passing threshold; do not guess a percentage or the
exact meaning of 'average' without a configured formula. A module marked
passed stays passed. Failed/unfinished current module remains current.
**OPEN:** exact per-module vs averaged score rule, retry frequency,
attempt limit, question shuffle and whether video completion is
mandatory before assessment; all must be Admin-configurable rather than
hard-coded without agreement.

## 5.4 Deadline and reactivation

If all three modules are not passed by the 72-hour deadline,
automatically deactivate the Telecaller and deny calling access. The
assigned Manager alone can reactivate them. On reactivation, return to
the **first failed or unfinished module**, preserving earlier passes; do
not restart from Module 1. Record original deadline, reactivation date,
Manager and reason. **OPEN:** duration of the new training window after
reactivation; it must be specified before production, rather than
silently granting another 72 hours or unlimited time.

## 5.5 Acceptance examples

A Telecaller passes Modules 1-3 within 72 hours and enters the queue; a
Telecaller finishing only Modules 1-2 at 72 hours is deactivated; on
Manager reactivation they resume Module 3; Telecaller training progress
and aggregate pass/fail counts are visible to the assigned Manager and
Admin.

# 6. Admin customer-list upload and assignment

## 6.1 Source and fields

Admin uploads purchased customer calling records whenever available,
including daily/weekly batches. The provided
offline_cards_20_jaipur_pincodes(1).xlsx has exact headings **NAME, PAN
NO, MOBILE, Pincode**. It does **not** contain a separate Location
column; resolve city/state from validated pincode/reference data where
possible, otherwise display 'Location unavailable'. Do not claim an
imported Location field exists in this sample. The business calling row
displays customer name, mobile, pincode, resolved location, ownership,
interaction status, next follow-up and call action. Treat PAN as
sensitive; hide/mask unless legitimately required.

## 6.2 Upload workflow

Admin selects customer-list upload -\> selects appropriate file/sheet
-\> sees header mapping and preview without unnecessary full PAN/mobile
exposure -\> validates required fields and eligible contact records -\>
reviews duplicate/conflict report -\> confirms import -\> receives
imported/rejected/skipped totals and an immutable batch reference -\>
assignment runs for successfully accepted records. Preserve original
file, source row number, uploader and upload timestamp in restricted
storage. Do not automatically redistribute a previously assigned
customer because a reupload contains that person.

## 6.3 Validations and deduplication

Validate mobile format, pincode length and type (preserve leading
zeros), blank mandatory values, duplicate rows in same batch and
duplicates of existing active records. A supplied PAN must not be used
as a broad search/display field. Exact duplicate-identity keys,
lead-refresh and reassignment policies are **OPEN** and require business
approval; do not merge customers merely because two names are equal.
Invalid or compliance-blocked records go to an Admin review/exclusion
queue, not to Telecallers.

## 6.4 Automatic allocation

After acceptance, distribute new eligible customer records among active,
**training-completed** Telecallers under all Managers, respecting
team/reporting scopes. Keep a documented allocation history with batch,
user, time and reassignment reason. The Admin sees organization-wide
assigned/unassigned/hidden totals; Managers see their team; Telecallers
only their own queue. **OPEN:** precise allocation algorithm (equal vs
capacity-/region-weighted), maximum load, business-hours constraints and
reassignment authority; implement consistent configurable rules, not a
random undisclosed algorithm. If no eligible Telecaller exists, records
remain visibly unassigned.

## 6.5 Active/hidden operational queues

Active queue includes untouched and follow-up-eligible customers; a
completed interest/link journey or explicit customer decline may be
hidden from routine calling without deletion. A follow-up customer
remains visible with due date and note. Provide authorized views/filter
to retrieve hidden customers and full history; preserve do-not-contact
suppression when a customer declines further contact.

# 7. Bank-specific pincode eligibility and credit card catalogue

## 7.1 Independent sources

The bank-wise pincode workbook is a **sourcing-location reference**; it
is not an MIS status feed and it is not a complete card catalogue.
Separately, Admin maintains card image/name/issuer, description,
categories, rewards/benefits, joining and annual fees, major charges,
eligibility highlights, applicable disclosures, application URL and
benefit PDF. A bank being sourceable at a pincode does not guarantee an
individual card is offered or a customer qualifies.

## 7.2 Actual uploaded pincode workbook structure

| **Bank sheet** | **Example header(s) from the uploaded file**                                                                                                     | **Required treatment**                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| EQUITAS        | CITY, DISTRICT, STATE, REGION, SOURCING PINCODE, BANK, Asset \_Branch_Code, LIABILITY_BRANCH CODE, Remarks                                       | Preserve sourcing pincode, branch codes and remarks; do not infer success from a nonblank remark.   |
| IDFC BANK      | EXTERNAL_CODE, MASTER_PINCODES_NAME, CITY, STATE, COUNTRY, NTB                                                                                   | Identify/validate the bank-specific pincode column before activation.                               |
| HSBC BANK      | CARDDELIVERYFLAG, CITY, COUNTRY, DISTRICT, FLAG, PINCODE, PINCODEFLAG, STATE, STATUS, STDCODE                                                    | Preserve delivery, flag and status dimensions; define bank-specific inclusion rules.                |
| Indusind bank  | Pincode, City, State/UT, Branch SOL ID, Added on                                                                                                 | Retain branch and bank-supplied added date.                                                         |
| rbl bank       | Pincode, City, City Code, City_Unique_Code, State, State Code, State_Unique_Code, Region Code, Country: Country Name, Sourceable, Is Online City | Show and enforce explicit sourceability/online-city values without equating the two.                |
| au bank        | CUST_PINCODE, CUST_STATE                                                                                                                         | Use actual bank-specific headings.                                                                  |
| yes bank       | PINCODE, District, STATE NAME, CITY NAME, city_code, REGION CODE, state_short, std_code, hub_location, branch_code, ICL/OCL, Policy, REGION      | Retain policy/ICL-OCL attributes; ignore empty auto-generated header columns only after validation. |
| AXIS BANK      | lender_id, pincode, city, state, address_type, lenderApiVersion, pincode_type                                                                    | Interpret pincode type and address type with bank-specific rules.                                   |
| SBI BANK       | lender_id, pincode, city, state, address_type, std, source_code, lenderApiVersion                                                                | Import all meaningful fields; source-code meaning must be confirmed before using it as a filter.    |

## 7.3 Import and matching rules

Admin imports each bank sheet with explicitly reviewed header mappings
and value semantics; pincode is stored as a six-character string, not a
number, and must not be matched by city alone. Maintain source
upload/version per bank. Where a bank encodes offline/online sourcing,
digital/physical availability, branch restrictions or policy flags,
display only supported routes and preserve original flags. Any ambiguous
flag stays 'Requires bank mapping' rather than automatically treating
the card as available. Do not incorrectly merge different bank files
into one universal schema without preserving the raw original rows.

## 7.4 Card presentation and customer lookup

On a customer's calling screen, use the customer's pincode to show
bank/card combinations that are both permitted by current bank-specific
location mapping and published by Admin for that location/channel.
Provide card image, bank, card name, category, benefits PDF, charges,
highlighted features and Admin-controlled link. Where no supported
combination exists, show 'No card available for this pincode from
current uploaded data', not 'Customer is ineligible'. Advisor catalogue
supports card browse, search by name/bank, categories (Travel, Shopping,
Premium/Top, Fuel, other Admin-configured), filters and card detail.
Exact per-bank card-to-pincode mapping is **OPEN** until KBS supplies
the production catalogue and approved sourceability semantics.

## 7.5 Initial application links (Admin-managed catalogue seed)

> **•**
> https://balaji-partner-h.getpopcard.co/?utm_source=SRIBALAJI&utm_medium=cardifye&utm_campaign=CADF43_KBS
>
> **•**
> https://cconboarding.au.bank.in/auccself/#/?utm_source=MMFNT&utm_medium=banner&utm_campaign=MMFNT-display-campaign-ENT-KBS_50263  
> These are user-supplied example partner/application URLs, not proof of
> a production API, availability, activation, commission event or
> specific card/pincode mapping. Admin must assign each link to its
> bank/card/channel, effective dates and approved sharing context.
> Preserve existing tracking query strings and URL fragments when
> sharing; do not incorrectly infer an application/reference number from
> a click alone.

# 8. Telecaller in-app calling, recording and WhatsApp workflow

## 8.1 Call-screen design and interaction sequence

Telecaller opens assigned customer -\> sees customer summary and
pincode-matched card choices -\> taps **Call** -\> the call is placed
using a business telephony solution integrated with the app -\> status
of call establishment appears without hiding the customer's card details
-\> Telecaller may expand a card and use WhatsApp share actions from the
same screen -\> after the interaction, Telecaller records call result,
selected/shared card, notes and follow-up or hide action -\> the
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

# 9. Telecaller network restrictions, device controls and training gate

## 9.1 Office Wi-Fi-only baseline

All protected Telecaller app actions, including customer-list retrieval,
call initiation and customer-detail viewing, must require a valid
authenticated Telecaller and an approved office-network context unless
an authorized WFH exception exists. Server-side access checks must not
rely solely on a displayed Wi-Fi SSID, which can be imitated. Admin
controls office-network allowlist and exception administration; the
relevant Manager may grant/remove WFH access for their Telecallers.
Record granting actor, scope, start/end (if used), revocation and access
outcome. **OPEN:** approved office egress IPs, rules for dynamic IP/VPN
and exception durations.

## 9.2 No restriction on FOS

Advisor use is **not** subject to Telecaller office Wi-Fi restrictions.
Do not accidentally block Advisor onboarding, lead creation, MIS views
or payout requests offsite. Manager/Admin mobile workflows must follow
their own access rules.

## 9.3 Screenshot and recording restrictions

Protect sensitive app surfaces against ordinary screenshots/screen
recordings using Android platform-provided secure-window facilities
where available. Apply policy to customer lists, PAN views, Advisor
identity/bank records and call/payout materials. Treat device cameras,
external screen capture, rooted/compromised devices and
accessibility-based extraction as residual risks; do not claim that
software can prevent every possible photograph or exfiltration.
**OPEN:** organization mobile-device management, rooted-device response,
accessibility requirements and web download/print policy.

# 10. Advisor onboarding, verification and reporting code

## 10.1 Signup steps

Public Advisor registration -\> mobile entry -\> OTP verification -\>
name and email -\> identity-verification consent/instructions -\>
official Aadhaar verification through an authorized permissible method
-\> bank-account details -\> cancelled-cheque upload -\> optional Agent
Code -\> review/submission -\> account available when mandatory
review/verification is complete. Only name, mobile and email are
mandatory personal profile fields explicitly specified by KBS; exact
bank field validation and verification provider contract are **OPEN**.
Record user consent before collection/verification and display the
privacy notice.

## 10.2 Aadhaar and verification safeguards

The verification must be authentic and compliant; do **not** presume KBS
is entitled to use an online Aadhaar authentication API merely because a
vendor offers one. Supported lawful options may include consent-based
UIDAI paperless offline e-KYC/QR verification or a properly authorized
partner route, to be selected after legal/provider review. Where offline
verification is used, verify signed evidence and retain only minimum
permitted evidence/results under approved policy, never casually log a
full Aadhaar number, XML/share code or Aadhaar image. Reference: UIDAI
offline verification guidance at
https://uidai.gov.in/en/307-faqs/authentication/offline-aadhaar-data-verification-service.html.
**OPEN:** exact legal role of KBS, provider eligibility, permitted
workflow, storage/retention and user-consent wording.

## 10.3 PAN and bank information

Advisor onboarding must securely collect bank details for external
manual payouts and allow a cancelled-cheque file; PAN verification
appears in the **customer lead** journey. If KBS also requires Advisor
PAN or payout-bank verification, that is a separate **OPEN** onboarding
requirement rather than an assumed field. Mask account numbers in
ordinary views; limit full bank-details access to authorized personnel,
and log privileged access. Keep verification result, request/reference
and failure/retry states distinct from bank MIS card status.

## 10.4 Agent Code and ownership

Advisor may enter an Agent Code during signup or later in Profile. A
valid code assigns the Advisor to its mapped person/Manager; empty code
assigns the Advisor directly under the sole Admin. Show the resulting
reporting person to the Advisor, Admin and appropriate Manager. Reject
an unknown/revoked code with a clear message and preserve a pending/none
result rather than assigning it to a random Manager. **OPEN:** code
format, whether a code can point to anyone other than Manager/Admin,
code expiry, repeated code changes, reparenting approval, and effective
date for future vs historical leads/payouts. These policies must be
resolved explicitly to prevent payout attribution changes.

# 11. Advisor credit-card discovery and lead/application experience

## 11.1 Business flow (corrected)

**Onboard and log in -\> browse/search/filter cards -\> inspect card and
available pincode sourcing -\> select card -\> create customer
operational lead -\> verify/collect customer information and
declarations -\> review -\> record lead reference -\> share/open
Admin-managed bank application link -\> await/display bank-reported MIS
status and remarks -\> act on a genuinely reported issue if relevant -\>
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

Customer mobile number -\> basic customer details/name -\> PAN entry and
verification state -\> current residence pincode and confirmed
city/state -\> employment choice **Salaried / Self Employed / Self
Employed Professional** -\> annual income as per ITR -\> required
customer declarations, Credit Bureau acknowledgement and applicable
consent -\> review all values and selected card -\> submit. Show
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

# 12. Corrected 29-screen FOS experience map

The original FOS draft lists 29 conceptual screens. Preserve their
functional coverage but interpret S21-S27 according to the **MIS-only
bank-status rule**. The product may combine adjacent screens for an
intuitive UI as long as all required information and actions remain
available. No visual screen sequence is authority to change bank status.

| **Original screen**             | **Required experience and correction**                                                                                          |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| S01 Welcome / Onboarding        | KBS branding, introduction, Skip/Next; no approval promises.                                                                    |
| S02 Credit Card Product Range   | Bank/NBFC branding and Admin-published credit card range.                                                                       |
| S03 Digital Selling             | Explain digital customer lead creation, issuer-link initiation and MIS-based tracking.                                          |
| S04 Credit Card Promotion       | Approved marketing content; no guaranteed approval.                                                                             |
| S05 Sell More, Earn More        | Advisor value proposition and Get Started without inventing payout rates.                                                       |
| S06 Mobile Number               | Advisor mobile entry, privacy/terms/consent.                                                                                    |
| S07 OTP Verification            | OTP, masked number, resend/edit and validated expiry; exact digit count and timer are implementation choices unless configured. |
| S08 Credit Card Home            | Cards, Create Lead, My Leads, actual Pending Actions, notifications, payout links.                                              |
| S09 Credit Card Catalogue       | Cards with image, bank, key benefits and fee highlights.                                                                        |
| S10 Credit Card Categories      | Travel, Shopping, Premium/Top, Fuel and configured categories.                                                                  |
| S11 Card Search and Filters     | Search issuer/card and meaningful business filters.                                                                             |
| S12 Credit Card Details         | Image, issuer, benefits, fees, disclosures, available Admin link, Create Lead.                                                  |
| S13 Customer Mobile             | New operational lead begins with customer's mobile number.                                                                      |
| S14 Customer Details            | Required basic information, correction and validation.                                                                          |
| S15 PAN                         | PAN capture and actual verification result; avoid unnecessary exposure.                                                         |
| S16 Pincode / Location          | Residence pincode with verified city/state or 'unavailable'.                                                                    |
| S17 Employment / Income         | The three specified employment types and annual income as per ITR.                                                              |
| S18 Declarations                | Explicit required declarations and Credit Bureau acknowledgement.                                                               |
| S19 Review and Submit           | Accurate summary; back/edit before submitting internal lead.                                                                    |
| S20 Lead Created                | KBS reference and next step; no implied bank submission/decision.                                                               |
| S21 Eligibility / Card Result   | Only genuinely available confirmed sourcing/eligibility; no inferred result.                                                    |
| S22 Application Initiation      | Share/open chosen issuer link; record only KBS operational action, not a bank-reported stage.                                   |
| S23 Pending Actions             | Display real MIS-supported or explicitly logged operational tasks, never fabricated tasks.                                      |
| S24 My Credit Card Leads        | Show separate real bank stage, decision, activation, bank remarks and MIS date.                                                 |
| S25 Lead Search and Filters     | Customer/reference search; card, bank, stage, decision, activation, date filters.                                               |
| S26 Lead Detail                 | Bank MIS current values and separate operational history; next action only if supported.                                        |
| S27 Application / Lead Timeline | **Replace old fixed progression** with chronological MIS updates and separate KBS activity log.                                 |
| S28 Notifications               | MIS changes, genuinely actionable tasks, payout updates and company notices.                                                    |
| S29 FOS Profile                 | Profile, reporting code, payout/bank summary, support and logout.                                                               |

# 13. Bank MIS import — authoritative data contract and processing

## 13.1 Source-of-truth boundary

The Admin uploads bank-provided MIS files when received, typically every
one to three days. There is **no automatic bank/aggregator
application-status API** and no third-party 'card activation verifier'
in scope. For any matched application, only the most recent **valid
accepted MIS row** may update the bank-reported CURRENT_STAGE,
FINAL_DECISION, card activation field, KYC results and bank-provided
remarks. KBS may store separate operational events and payout events,
but these may never overwrite a bank MIS value.

## 13.2 HDFC sample: exact 36 column names and business use

The supplied HDFC sample (KBS804%20HDFC%20MIS_recreated(1).xlsx, Sheet1)
has the following headings **as written**. Some include spelling
inconsistencies; keep raw header and raw value intact, then map into a
controlled internal field with a bank/version-specific import profile.

| **\#** | **Exact Excel column**       | **Requirement / semantic group**                                                                                |
|--------|------------------------------|-----------------------------------------------------------------------------------------------------------------|
| 1      | Application No               | Bank application identifier candidate; retain original string.                                                  |
| 2      | LC2_CODE                     | Bank/partner code; assist provenance/attribution only when contractually defined.                               |
| 3      | CURRENT_STAGE                | **Primary current bank application stage**; show independently.                                                 |
| 4      | APPLICATION_REFERENCE_NUMBER | Bank reference identifier candidate; retain original string.                                                    |
| 5      | CREATION_DATE_TIME           | Bank-provided creation timestamp; do not substitute upload time.                                                |
| 6      | CUSTOMER_TYPE                | Contextual customer type, as reported.                                                                          |
| 7      | CUSTOMER_NAME                | Sensitive bank customer name; not sufficient alone for lead matching.                                           |
| 8      | CHANNEL                      | Bank/channel information; preserve and show in Admin detail as needed.                                          |
| 9      | IPA_STATUS                   | IPA result; separate from FINAL_DECISION and activation.                                                        |
| 10     | DAP_FINAL_FLAG               | Bank flag; semantics must be documented, never inferred.                                                        |
| 11     | DROPOFF_REASON               | **Bank-provided reason** for dropped/incomplete case when supplied.                                             |
| 12     | IDCOM_STATUS                 | IDCOM status, if relevant.                                                                                      |
| 13     | VKYC_STATUS                  | Video KYC status; independent bank-reported field.                                                              |
| 14     | VKYC_CONSENT_DATE            | Bank-supplied video KYC consent date.                                                                           |
| 15     | VKYC_EXPIRY_DATE             | Bank-supplied video KYC expiry date.                                                                            |
| 16     | CAPTURE_LINK                 | Bank-provided link; only show/use if authorized and validated, do not assume it is a customer application link. |
| 17     | PROMO_CODE                   | Campaign/promo context; may aid attribution if agreed.                                                          |
| 18     | PRODUCT_CODE                 | Bank product code; mapping to Admin card catalogue may be required.                                             |
| 19     | FINAL_DECISION               | **Bank-reported final decision**; distinct from CURRENT_STAGE and activation.                                   |
| 20     | FINAL_DECISION_DATE          | Date of final decision, if provided.                                                                            |
| 21     | DECLINE_CODE                 | Bank decline code; display in authorized details if present.                                                    |
| 22     | DECLINE_DESCRIPTION          | Bank decline text/category; preserve even if another column contains more detail.                               |
| 23     | CURABLE_FLAG                 | Bank-reported curability flag; not a standalone permission to contact or edit bank status.                      |
| 24     | COMPANY_NAME                 | Contextual company information; treat as customer-sensitive.                                                    |
| 25     | BKYC Status                  | Biometric KYC status; keep separate.                                                                            |
| 26     | Reason                       | Additional bank reason, including KYC context.                                                                  |
| 27     | KYC Status                   | Bank-reported KYC result; separate from card decision.                                                          |
| 28     | Decision Month               | Bank reporting period field; do not overwrite event date.                                                       |
| 29     | Decline Descreption          | Additional decline description; original spelling preserved.                                                    |
| 30     | Decline Type                 | Decline category/reason; separately displayed if supplied.                                                      |
| 31     | Product Des                  | Bank product description; card crosswalk candidate.                                                             |
| 32     | Secured/Unsecured            | Reported product classification.                                                                                |
| 33     | KYC Success/NR               | Additional bank-supplied KYC-related field; do not infer from arbitrary values.                                 |
| 34     | Card Type                    | Bank-reported card type.                                                                                        |
| 35     | Creation Date                | Additional bank date; preserve independently from CREATION_DATE_TIME.                                           |
| 36     | Card Activation Staus        | **Bank-reported card activation status**; original misspelling must be supported.                               |

## 13.3 Verified distinct value groups in the HDFC sample

> **•** CURRENT_STAGE values in the sample include Decisioned Cases,
> Decisioned Cases and Card setup completed, Document Curing,
> In-Complete Application, Pending for Biokyc, System Queue.
>
> **•** FINAL_DECISION sample values are Approve, Decline, Inprocess.
>
> **•** Card Activation Staus sample values are INACTIVE, V + ACTIVE,
> TXN ACTIVE - Rs 100, and \#N/A.
>
> **•** KYC Status sample values include Expired, NR, Not Eligible,
> Success; VKYC_STATUS includes VKYC InComplete and vKYC Success; BKYC
> Status includes Closed, Completed and \#N/A.
>
> **•** Decline/reason fields may have \#N/A, an internal code,
> document-curing text, policy-related text or customer refusal
> information. **Preserve every meaningful field as bank text rather
> than collapsing it into a generic 'Rejected'.**

These are observed sample values, **not** an exhaustive live bank enum
list or a confirmation of what each activation value means for
commission. Future MIS profiles must accept new values after appropriate
review without losing originals.

## 13.4 MIS import user journey

> **1.** Admin chooses **Upload bank MIS**, bank, import profile/version
> and workbook file. If the file contains several sheets, Admin chooses
> or maps each bank sheet explicitly.
>
> **2.** Validate file type, readable workbook, headers, required
> identifier/status column mapping, date formats, row length and
> expected bank. Do not accept a pincode-list workbook or customer
> calling list as an MIS upload merely because it is Excel.
>
> **3.** Present preview including row count, candidate
> application-reference coverage, blank status counts, distinct new
> status values, probable duplicate references, probable matched leads,
> unmatched rows and conflicts. Preview must avoid broad exposure of raw
> customer PII.
>
> **4.** Admin confirms processing; save immutable source file with
> bank/profile, checksum, import batch ID, uploader, upload time and
> per-row provenance.
>
> **5.** Resolve rows to existing applications via an approved exact
> bank-scoped reference linkage. Apply valid updates to bank fields only
> and append change history; never change KBS operational activity or
> the original source file.
>
> **6.** Record imported, updated-no-change, updated-with-change,
> unmatched, duplicate/conflict, rejected-invalid and requires-review
> totals. Admin can open row-level explanations and correct a
> mapping/linkage through an audited review flow where allowed.
>
> **7.** Recompute authorized dashboards, actual MIS update
> notifications and payout eligibility for correctly matched records.
> Release a batch only after validation/processing reaches a consistent
> accepted state.

## 13.5 Deterministic matching and identity

The application must retain a KBS lead ID, bank identifier, bank
application number and/or application reference number if known.
**Bank + reliable exact reference** is the intended matching key; use
the bank's own reference rules and a documented card/partner crosswalk
where required. Preserve exact string representations, including leading
zeros. Do not auto-match based only on customer name, mobile, PAN,
proximity of application dates, product description or an approximate
text similarity score. If references disagree, are reused, missing or
map to multiple leads, quarantine the MIS row for Admin resolution and
do not silently move bank status to a guessed lead. **OPEN:**
issuer-specific unique reference contract and verified way to capture
issuer reference from customer link journeys.

## 13.6 Existing vs absent vs missing-value behaviour

| **Condition**                                            | **Required outcome**                                                                                                                                                                                                            |
|----------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| New valid MIS row matches a lead                         | Update only bank-reported fields supplied by the accepted mapping; record source and status changes.                                                                                                                            |
| Same lead reported in latest sheet with same values      | Record that this MIS batch contains/confirmed the lead without creating a fake status transition.                                                                                                                               |
| Existing lead absent from a new sheet                    | Keep last accepted bank values, show **last matched MIS date**, and do not mark rejected/cancelled/expired or claim recent confirmation.                                                                                        |
| Lead never appears in any accepted MIS                   | Show **Awaiting MIS Update** for bank status, with no invented bank stage or decision.                                                                                                                                          |
| A status cell is blank or \#N/A                          | Show Not reported for that field; preserve raw cell and distinguish unknown from negative result. Whether blank supersedes a previously known value depends on an expressly configured full-snapshot vs delta-file rule (OPEN). |
| New MIS has no usable unique identifier                  | Leave row unmatched and present Admin review; no name-only auto-link.                                                                                                                                                           |
| Two contradictory rows for same reference within a batch | Mark conflict, do not choose based on file row order without an approved bank rule.                                                                                                                                             |
| Reimport exact same file                                 | Avoid duplicate status-history/notification/payment eligibility effects; show previously processed source batch.                                                                                                                |
| Bank sends retroactive correction                        | Keep complete prior and corrected values with source file/time, recalculate current bank reports and flag any financial consequence for review; do not silently delete existing payment history.                                |

## 13.7 Bank-specific import profiles

HDFC headings above are an example only. Each contracted issuer must
have a validated import profile specifying: accepted sheet/file format,
required identifiers, header aliases, distinct stage/decision/activation
columns, original bank value vocabulary, date/timezone semantics,
reason/remarks columns, partial vs full-snapshot update semantics, exact
matching reference, product code mapping and payout-eligible event
interpretation. Admin may upload a profile only after review. An
unrecognized column/status must not crash the import or be silently
converted to a known business outcome; display it as an unmapped raw
value pending mapping.

## 13.8 Date provenance

Display separately: KBS internal lead-created time; KBS
link-shared/initiated time; bank-reported creation/decision/KYC event
dates if present; KBS MIS **file received/uploaded time** and last
**matched status update time**. A user's 'last MIS update' must mean the
last accepted batch containing/updating **that lead**, not the global
last time Admin uploaded an unrelated bank file. Avoid deriving bank
event dates from the file's filename or upload time.

# 14. Status and remarks presentation (mobile and web)

## 14.1 No fixed bank-state machine

The old proposed visual path Lead Created -\> Application Initiated -\>
Customer/FOS Action -\> Application Submitted -\> Under Processing -\>
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
| \#N/A or empty                     | Not reported        | Unknown/absent, not active, inactive, approved or rejected by inference.                                |

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

For a given lead, group changes by imported batch; show old-\>new exact
bank value per changed field, reported bank event date if available, and
KBS import timestamp/uploader. An identical repeat should not create a
fictional stage movement. New notifications should state only the
changed value or confirmed action, e.g., 'Bank MIS updated: Final
decision = Approve; activation = INACTIVE', not 'Your card is activated'
unless the activation field actually confirms the configured event.
Notifications are role-filtered and contain no unnecessary PAN/full bank
account numbers.

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

# 17. Activated-card entitlement and complete Advisor payout workflow

## 17.1 Non-negotiable eligibility source

An Advisor may request a payout only for an **attributed, uniquely
identified card entitlement** whose applicable
activation/commission-trigger event is evidenced by the latest accepted
bank MIS under KBS's approved bank-specific payout policy. Neither
FINAL_DECISION=Approve, card setup, KBS lead creation, link sharing nor
a Telecaller's interest outcome is sufficient by itself. Maintain the
raw HDFC activation values (V + ACTIVE, TXN ACTIVE - Rs 100, INACTIVE,
unavailable) distinctly. **OPEN / LAUNCH BLOCKER:** documented per-bank
trigger (and whether issuer payout requires bank settlement, first
transaction or hold period), amount per card/product/period, bank
reversal handling and interpretation of the different HDFC
active-looking values. The MIS remains the only source of event
confirmation even if a separate rate table specifies payment amounts.

## 17.2 Advisor payout home

Advisor sees a card-level ledger: KBS lead, bank/card, bank reference,
last matched MIS date, raw activation status, whether current configured
rule makes the card payable, amount under the approved rate table, and
payout position (available / reserved in request / pending both
approvals / approved awaiting Accounts / paid / under review). Show
distinct totals for eligible count, available-to-claim count, requested
count, approved but unpaid and paid count/amount. Do not expose another
Advisor's customer or payment details.

## 17.3 Request creation and reservation

Advisor selects eligible available card events (or all eligible
available), reviews itemized card count and expected amount, and submits
a payout request. At submission, **atomically reserve** each selected
event against that request. Prevent another pending request from
including the same entitlement, including double-tap and simultaneous
requests from two sessions. An unconfirmed/rejected/unknown activation
or a card already reserved/paid must not be selectable. Store request
ID, Advisor, Manager/Admin reporting context, exact event IDs/card
references, rate/rule version, amount, submission time and itemized
snapshot. A submitted request does **not** itself mean payment is
approved or completed.

## 17.4 Dual approval

The assigned Manager **and** the Admin must approve **every** request
before Accounts may pay. Present itemized cards, evidence from MIS, rule
version, amount, prior request/payment links and any exception warnings.
Record individual actor, role, decision, timestamp and reason. The
Manager and Admin receive app notifications; Admin retains
organization-wide oversight. An Admin action must not be silently
treated as both required approvals. For an Advisor assigned directly
under Admin without a Manager, KBS must define a designated independent
Manager approver (**OPEN**); the system must not skip the required
Manager step.

## 17.5 Approval order and rejection

The requirement mandates both approvals but does not explicitly demand
an order. Support two distinct approval records and reveal which
approval remains outstanding; configuring Manager-first and then Admin
is a reasonable implementation **proposal**, not a silently assumed
business rule. On reject, show requester the recorded reason and apply
an approved release/resubmission policy so a card cannot remain
permanently reserved by an abandoned request. **OPEN:** rejection
edit/resubmission process, who can cancel a request, maker-checker
segregation and time limits.

## 17.6 Accounts external payment

After both approvals, Accounts sees a ready-for-payment row with Advisor
name, verified masked payout-bank details, request/approval IDs, card
count, itemized cards, approved amount and approval audit. Accounts
executes a **manual transfer outside KBS**, then records paid date,
amount, transfer reference, payment method if relevant, and uploads
payment proof/receipt. KBS stores a controlled payment record and links
it to exactly that request and its card events. Do not include any
in-app disbursement button that transfers funds.

## 17.7 Settled state and no duplicate claims

On confirmed manual payment and required proof, mark the request 'Paid'
and its linked card entitlements 'Paid for this event'. Reduce the
available-to-claim card count accordingly; do not reduce the historical
MIS activation count or alter bank activation values. The Advisor sees
paid cards and receipt summary; Manager/Admin/Accounts can trace each
payout card to request, both approvals and proof. Reject duplicate bank
transaction references or multiple payments of one request unless an
explicit audited correction workflow exists. Any partial payment,
reversal, bank correction after payment or overpayment must be surfaced
as an exception for Admin/Accounts; do not silently create clawback or
refund modules in the MVP.

## 17.8 Recommended payout-state vocabulary (not bank status)

Available for claim -\> Reserved / Request submitted -\> Manager
approval pending and/or Admin approval pending -\> Both approved /
Accounts payment pending -\> Paid, with explicit Rejected, Cancelled, On
hold / review exception labels where policy permits. These are **KBS
payment-workflow** states only. They must not appear as application
status, and none of them sets Card Activation Staus.

## 17.9 Payout math and reconciliation

At any instant: **available payable events = uniquely MIS-eligible
entitlements - entitlements reserved by active requests - entitlements
already paid for the same payable event**. Show source time and rule
version. Approved outstanding amount = fully approved unpaid request
amount; paid amount = externally confirmed transfer amount, not simply
total approved amount. Reconcile count and amount between Advisor,
Manager, Admin and Accounts views using the same ledger. A rate changed
after a claim must not silently rewrite an already approved/paid
snapshot. **OPEN:** actual remuneration/rate contract, taxes/withholding
policy outside MVP statement generation, partial settlements and
bank-event uniqueness across reissued cards.

# 18. Accounts workspace and proof management

## 18.1 Screens and actions

Accounts logs in with mobile OTP -\> views **Awaiting payment**
(dual-approved only), **Paid**, and **Exceptions/needs correction**
queues -\> opens a request -\> verifies approved card count, payee bank
summary, approved amount and both approval records -\> pays manually
using bank/finance tools outside KBS -\> records transfer
reference/date/amount -\> uploads documentary proof -\> submits payment
record -\> sees locked paid summary. Restrict access to necessary payee
banking fields, full cancelled-cheque files and proof documents.

## 18.2 Data and permission rules

Accounts cannot modify Advisor reporting hierarchy, import MIS, change
activation, adjust payout-rule eligibility or approve on behalf of
Manager/Admin. Accounts can flag an amount/bank discrepancy and return
it to Admin for resolution; do not permit silent editing of approved
request card list or approved amount after both approvals. Admin and
relevant Manager see the payment record and proof according to
permissions; Advisor sees payment confirmation and a privacy-safe
receipt summary.

## 18.3 Audit and reconciliation

Persist payer operator, timestamp, payment status, payment reference,
proof file identifier, approved request and itemized card entitlement
keys. Prevent a card/payment reference from being unlinked from its
completed claim. Corrections must preserve the prior entry and actor.
**OPEN:** whether payment can be partial/split; until specified, one
approved request is either unpaid or fully recorded paid, with
mismatched amount held for review.

# 19. Notifications and in-app event routing

## 19.1 Mandatory notifications

> **• Telecaller/Manager:** new assignment, training
> deadline/deactivation/reactivation, WFH grant/revocation, assigned
> follow-up due, call recording available/failure if operationally
> relevant.
>
> **• Advisor:** onboarding/verification issue, lead operational
> confirmation, new MIS match, actual MIS decision/stage/activation
> changes, bank-reported actionable issue, payout submission,
> Manager/Admin approval/rejection and Accounts payment confirmation.
>
> **• Manager:** Telecaller training exceptions, team operational items,
> Advisor request requiring Manager approval and resulting payment
> updates.
>
> **• Admin:** import completed/failed/unmatched/conflicted, bank
> mapping anomalies, company metrics where configured, Advisor request
> requiring Admin approval, payment exception and privileged-security
> event.
>
> **• Accounts:** request enters payment queue **only after both
> approvals**, request/payment exception and pending proof.

## 19.2 Event semantics

An MIS alert cites which raw reported field changed and the date of the
accepted matching batch; it must not say 'approved/activated' unless the
specific relevant MIS field and configured rule support that claim.
Deduplicate repeated identical imports and restrict recipient scope by
ownership/hierarchy. A notification should deep-link to the correct
authorized record; after ownership change or revocation,
permission-check again before showing content. **OPEN:** push provider,
expiry, customer-visible notifications (not requested) and escalation
policy.

# 20. UX, visual design and technology constraints

## 20.1 shadcn/ui requirement and platform reality

The web UI MUST use **shadcn/ui** components and a consistent design
system; **Tamagui and any substitute full UI framework must not be
used**. shadcn/ui's web component implementations are web/DOM oriented
and cannot simply be imported as native Android controls. Build an
**aligned React Native component set following the same shadcn visual
tokens/interaction principles** (for example, a carefully vetted React
Native shadcn-style component registry or in-house native components).
This is a platform-compatible implementation of the user's design
requirement, **not** a license to add an unrelated full UI framework.
Shared tokens: spacing, typography, semantic colors, component shape,
iconography, field/error states and interaction semantics.

## 20.2 Product-level visual outcomes

Provide a polished, intuitive and consistent experience on Android and
web with clear hierarchy, touch-friendly layouts, accessible contrast,
readable numbers and restrained high-quality animations. Make primary
tasks available immediately from each role's home; use progressive
disclosure for large MIS data sets. Application stage, final decision,
activation and payout state must each have visually distinct labels and
explicit text, never color alone. Customers' sensitive fields are masked
by default as appropriate. No screenshot/download control should
undermine defined Telecaller privacy policy.

## 20.3 Required components and responsive behaviour

> **• Web:** shadcn navigation/sidebar, cards, dialogs, command/search,
> accessible data tables, upload review steps, status badges, filters,
> date-range controls, drill-down detail views, documents/recording
> viewer and notification drawer.
>
> **• Mobile:** native bottom/tab/stack navigation, compact lead cards,
> expandable bank detail, robust OTP, multi-step form with persistent
> selected card, persistent calling controls, full-width WhatsApp
> actions, readable payout ledger and adaptive empty/error/loading
> states.
>
> **• Shared UX patterns:** explicit provenance chips (Bank MIS, KBS
> activity, Accounts payment); distinguish 'Awaiting MIS Update' from
> actual reported Inprocess; require confirmation for sensitive
> irreversible actions; display upload freshness and last matched
> status; provide safe retry without duplicate side effects.

## 20.4 User-centred role specifics

Telecaller screen maximizes call context and card/share actions; Advisor
minimizes effort in customer lead creation and clearly separates link
initiation from actual bank results; Manager prioritizes team
drill-down; Admin prioritizes data integrity and reports; Accounts
prioritizes dual-approval audit, itemized payment and proof. If a bank
column has no meaningful value, use 'Not reported' rather than an
unlabeled dash. Never hide a conflicting MIS row behind a green
aggregate KPI.

## 20.5 Accessibility and localization

English only in initial release. Ensure readable text scaling,
accessible labels/keyboard/focus on web, sufficient contrast, clear
field-error descriptions and large touch targets. Some protected-screen
controls may interact with accessibility services; evaluate security
without silently blocking assistive technologies. India-oriented
formatting (INR, local phone/date conventions) should be consistent
while preserving raw source timestamps/time zones.

# 21. Sensitive information, privacy, calling compliance and recording safeguards

## 21.1 Data categories and minimization

Classify and restrict customer mobile, PAN, bank MIS/customer data,
Advisor Aadhaar verification evidence, bank account/cancelled cheque,
call recordings, application links with partner tracking, company ID
cards and payout proof. Do not store full Aadhaar numbers or raw offline
e-KYC packages/share codes by default. Mask PAN and bank account where
their full content is not necessary; avoid placing sensitive strings in
URLs, client logs, error traces, analytics events, notifications or
exports. Encrypt in transit and at rest; apply role-based document
access and protected delivery URLs with expiry where suitable.

## 21.2 Third-party purchased calling lists

KBS states it purchases customer data from third parties. **Purchase
alone is not sufficient evidence that a customer has consented to KBS
credit-card solicitation.** Before a batch is activated for calling,
require the relevant source/consent representations, approved
permitted-use basis, suppression/DND procedure,
calling-time/communication rules and vendor-provenance process to be
confirmed by KBS compliance. Store source and do-not-contact controls;
block or exclude records disallowed by approved policy. Official TRAI
guidance on commercial-communication sender obligations and customer
preferences is available at https://www.trai.gov.in/advice-to-senders
and https://www.trai.gov.in/tcccpr. Exact legal interpretation and
operational SOP must be approved for the actual campaign and telephony
provider.

## 21.3 Call recordings and communications consent

Use a compliant telephony route, give required disclosures, respect call
recording/customer consent rules and apply purpose-specific recording
access/retention. Automatic recording should be attempted on eligible
connected calls through the chosen provider; report recording failures
and never promise a recording exists if one does not. Store contact
opt-out and restrict further calling. WhatsApp consent/template
restrictions and document-delivery evidence must be respected as a
separate communication channel.

## 21.4 Aadhaar verification

An official UIDAI paperless offline e-KYC flow is a possible
verification pattern when permissible; verify the signed payload
according to UIDAI guidance and avoid unauthorized storage/share of
Aadhaar data. The precise Aadhaar verification mode/provider, whether
KBS is an eligible verification entity, consent, retention and audit
must be approved before launch. UIDAI reference:
https://uidai.gov.in/en/307-faqs/authentication/offline-aadhaar-data-verification-service.html.

## 21.5 Operational security requirements

OTP rate limits, session expiry/revocation, server-enforced RBAC,
authorization on every object/file/recording, app access policy, secure
document/object storage, upload malware scanning, audit logs, secret
handling and restricted exports are mandatory design concerns. Maintain
an authorized mechanism for deleting/restricting records under
applicable policy without silently deleting bank/payout audit trails
needed for legitimate obligations. **OPEN:** final data-retention
durations, records of consent, backup/restore targets, incident response
owners, acceptable document stores and precise compliance obligations
under KBS's contracts.

# 22. Conceptual data model and ownership (requirements, not database design)

| **Business entity**           | **Minimum relationships/data**                                                                                          | **Authoritative input**                                 |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------|
| User / Role                   | Mobile, role, enabled state, authentication/security history                                                            | KBS account administration / signup.                    |
| Reporting assignment          | Advisor Agent Code, Manager/Admin parent, effective date/history                                                        | Approved KBS hierarchy policy.                          |
| Training enrollment           | Telecaller, first login, original deadline, modules, scores/pass history, reactivation                                  | KBS training activity and Admin content.                |
| Customer calling record       | Source row/batch, customer name/mobile/pincode/PAN-restricted, Telecaller assignee, suppressed/hidden status            | Admin-uploaded customer list + KBS allocation.          |
| Card / product / link         | Bank, product code, published description, pincode/channel sourcing, fees, PDF, application URL/version                 | Admin card catalogue and bank pincode uploads.          |
| Call / operational activity   | Telecaller, customer, call/provider ID, actual call result, recording, remarks, share actions                           | In-app activity + telephony/WhatsApp provider results.  |
| Advisor lead                  | Advisor, customer consent/details, card, KBS lead ID, own application-link activity, reporting parent snapshot          | KBS Advisor flow.                                       |
| Bank application linkage      | Bank, confirmed issuer application number/reference, KBS lead, match verification                                       | Reliable bank reference and approved linkage.           |
| Bank MIS batch / row          | Bank/profile, immutable file, uploader/times, original row/fields, match/conflict outcome                               | Admin-uploaded bank MIS.                                |
| Reported bank status snapshot | Current stage, final decision, KYC substatuses, activation, bank reasons, source row and last matched batch             | **Only accepted matching MIS row**.                     |
| MIS change history            | Old/new raw field values, source batch/time, bank event date if present                                                 | Accepted MIS update processing.                         |
| Payout entitlement            | Advisor/lead/card payable event, approved bank-specific trigger, rate version, eligibility and reservation/paid history | MIS evidence + approved KBS commercial policy.          |
| Payout request/approvals      | Selected entitlements, amount, Manager and Admin decisions, audit                                                       | KBS dual-approval workflow.                             |
| External payment              | Accounts operator, transfer reference/date/amount, proof, request linkage                                               | Accounts-recorded external payment evidence.            |
| Notification / audit          | Intended recipient/record/event, event source, read/time, actor/change reason                                           | KBS events with MIS source reference where appropriate. |

## 22.1 Separation constraints

Customer calling records, Advisor leads, bank MIS rows and payout
entitlements are separate entities even when they mention the same
human/card. No accidental one-to-one assumption: a person may have
multiple bank applications, a bank reference must match an
issuer-specific application, and an Advisor may have multiple card
entitlements. Reporting parent changes and card/payment settlements need
effective-dated history. File versions, status snapshots and payment
snapshots must be reproducible from audit evidence without exposing raw
PAN/Aadhaar in normal UI.

# 23. Error states, conflicts and recovery paths

## 23.1 Authentication and access

OTP incorrect/expired/rate-limited; disabled account; Telecaller
training overdue; Telecaller outside approved office network without WFH
permission; Manager/Advisor moved teams; denied document access; session
invalidated. Show a clear role-appropriate message and a valid recovery
action without revealing whether an unrelated phone number/customer
exists.

## 23.2 Training and queue

Video unavailable; submission interrupted; wrong/insufficient MCQ score;
72-hour deadline reached during assessment; Manager tries to reactivate
a Telecaller outside their team; no eligible assignees on upload;
duplicate customers; customer requests no further contact; previous
record hidden then reappears in new purchased batch. Preserve
progress/history; fail closed on access; do not erase suppression.

## 23.3 Calling and sharing

Provider busy/offline, call never connected, callback required,
recording denied/failed, WhatsApp not installed or customer hasn't
consented, PDF missing, expired company ID, revoked bank link, no
pincode mapping. The UI must report what is known and prevent a
misleading 'Call completed', 'Recorded', 'PDF delivered' or 'Customer
eligible' success badge.

## 23.4 Lead initiation and MIS

Issuer website opens but no application reference returns; KBS lead
submitted twice; customer corrects PAN; pincode maps to no issuer; MIS
has unexpected header, conflicting duplicate bank reference, unknown
status, an absent old lead, a stale earlier batch or \#N/A activation.
Preserve separate operational and bank status; quarantine conflicts; use
'Awaiting MIS Update' or 'Not reported' as appropriate; keep prior
accepted status with its actual freshness label.

## 23.5 Payout exceptions

Simultaneous claims on same eligible card; request awaiting one of two
approvals; request rejected; Advisor directly under Admin (no assigned
Manager); paid request with missing proof; external transfer amount
differs; rate adjusted after request; bank MIS corrects a previously
reported activation. Hold ambiguous payments for Admin/Accounts review;
don't double-pay or silently reverse history. Any additional
compensating-payment/clawback process requires a later, separately
agreed scope.

# 24. Non-functional and operational acceptance requirements

## 24.1 Reliability and data correctness

MIS import must be idempotent for identical source batches, preserve raw
files and never partially publish inconsistent calculations as a
finished update. Payment reservations and settlement must avoid
duplicate entitlement use. Search, reporting and notifications must
respect row-level permissions. Failed operations should have
retry/reconciliation without creating duplicate calls, lead submissions,
MIS transitions or payouts.

## 24.2 Scalability and performance

Design for unknown production sizes: number of
Telecallers/Advisors/Managers, daily calling records, call concurrency,
MIS file row counts, recording volume and retention are **OPEN capacity
inputs**. Before launch, KBS should approve measured acceptance
thresholds for OTP/login, customer queue, card lookup, MIS batch
processing, dashboard refresh and report search. Do not invent a 99.9%
SLA or numerical response-time guarantee without agreed load and cost
constraints.

## 24.3 Auditability and observability

Every accepted/rejected upload, mapping revision, lead reference
linkage, bank status change, Telecaller assignment/WFH grant, training
reactivation, payout decision and manual payment must have an
actor/time/source trace. Admin sees operational errors and unmatched
rows, not just successful totals. Avoid storing raw PII in logs. Backup
and restoration must preserve bank MIS provenance and payment proof
relationships.

## 24.4 File/document lifecycle

Validate Excel size/type/content, protect against malicious workbook
content, preserve source files and support safe retry. PDFs, cancelled
cheques, ID cards and payment proofs require content-type validation,
access controls and malware scanning. Recording/document downloads must
be restricted or disallowed according to role policy. Exact retention
and object-storage provider are implementation decisions subject to
approved legal/contract requirements.

## 24.5 Release quality

All critical flows must pass acceptance tests across Android and web,
including poor connectivity and authorization failures. Verify Android
secure-screen protection on supported device versions but clearly
document limits. Test browser/mobile accessibility, long/missing MIS
values, long bank decline reasons, varying bank headings, different
timezones/date formats and simultaneous payout submissions.

# 25. Role-specific screen inventory and navigation

## 25.1 Shared screens

OTP login; role-aware access error; profile/support/logout;
notifications with record deep-link; masked sensitive-data reveal only
under permission; session-expired recovery; no-connection/retry and
account-deactivated explanations. Each role returns to its own home
after successful OTP and prerequisite checks.

## 25.2 Telecaller Android screens

| **Screen**              | **Primary information/actions**                                                               | **Exit/next**                                             |
|-------------------------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------|
| Training landing        | Three modules, completion/checks, first-login deadline, current module, reason if deactivated | Active module or Manager reactivation message.            |
| Module learning         | Admin video, relevant learning material, progress                                             | MCQ assessment after configured prerequisites.            |
| MCQ result              | Correctness/score, pass threshold and retry availability                                      | Next module only after pass; queue after Module 3.        |
| My Calling Queue        | Assigned customers only; name, masked mobile, pincode/location, status, callbacks, Call/Open  | Customer calling desk.                                    |
| Customer / Calling Desk | Customer, sourceable cards, PDF, official ID, share link, in-app call, call state, remarks    | Save outcome; follow-up queue or hidden history.          |
| Card Detail in Call     | Bank/card, pincode/channel availability, benefits/fees, PDF/link                              | Return to live call context without losing call controls. |
| Interaction Detail      | All attempts, real recordings if available, shared material, operational remarks              | Continue safe permitted follow-up.                        |
| Follow-ups              | Due callback customers, latest operational note                                               | Open customer; reschedule/complete within policy.         |
| History / Hidden        | Completed/declined calling records permitted by own assignment                                | View; no deletion or suppressed recontact.                |
| Official ID             | Company identity card and revocation/validity information                                     | Share through authorized customer action.                 |

## 25.3 Manager mobile and web screens

Team overview; Create Telecaller; Telecaller
profile/training/deactivation/reactivation; WFH exception
administration; allocation and calls; customer operational
history/recording access; Advisor team and lead-MIS details; team
analytics; payout requests and approval detail; approval history;
notifications; profile/logout. Mobile may use smaller cards/filters; web
may use richer full-width data tables, but authorization and calculation
must be consistent.

## 25.4 Admin web screens

Executive dashboard; Managers/users/roles; Telecaller training content
and test configuration; customer calling Excel import/mapping/result;
allocation oversight; bank-specific pincode file import/mapping/result;
card catalogue/editor/PDFs/application links; MIS Excel
import/profile/preview/match/conflict/log; cross-role customers,
operational leads and Advisor applications; organization analytics by
source; telephony/WhatsApp delivery/recording oversight; network/WFH
policy; Agent Code/hierarchy management; payout rules (once approved),
payout approval and ledger; payment proofs; compliance/suppression;
audit and exceptions; notifications/account. The one Admin owner must
retain final business visibility, but sensitive-data read/export must be
audited.

## 25.5 Accounts web screens

Pending dual-approved payments; payout request detail with two approval
records; masked payee-bank details; manual payment record form; proof
upload/verification; paid ledger; payment exceptions;
notifications/profile. No status-edit control exists here.

# 26. End-to-end cross-role scenarios

## 26.1 Telecaller customer interaction

> **1.** Manager creates Telecaller from name+number; employee ID is
> generated.
>
> **2.** Telecaller logs in by mobile OTP, starts 72-hour training,
> passes three MCQ/video modules sequentially and gets assigned customer
> records only after completion.
>
> **3.** Admin imports calling workbook; records pass
> validation/compliance checks, then allocate automatically under all
> Managers' eligible Telecallers.
>
> **4.** Telecaller opens assigned customer's pincode; KBS uses the
> correct bank-specific sourceability mapping and Admin card catalogue
> to show applicable products, PDFs and links.
>
> **5.** Telecaller taps in-app Call; provider handles call and
> recording where authorized; UI remains on calling desk with
> card/WhatsApp actions.
>
> **6.** Customer requests benefits/office ID/card link; Telecaller
> shares each as appropriate; record share attempt/result against the
> customer.
>
> **7.** Telecaller logs interest/decline/follow-up and notes; follow-up
> stays active while completed/declined row may be hidden without
> deletion; do-not-contact enforced.
>
> **8.** Assigned Manager and Admin can see attempts, confirmed
> connected calls, recordings and interaction results. No step changes
> bank status or creates Telecaller commission.

## 26.2 Advisor application and MIS refresh

> **1.** Advisor self-registers by mobile OTP, completes name/email,
> authorized Aadhaar verification, payout bank details/cheque and
> optional Agent Code (blank -\> Admin parent).
>
> **2.** Advisor browses available cards by bank/category, reviews
> benefits/fees/disclosures and selects a card.
>
> **3.** Advisor enters customer mobile/basic
> details/PAN/pincode/employment/annual ITR income/declarations; reviews
> and submits **KBS operational lead**.
>
> **4.** Advisor sees KBS lead reference, shares/opens Admin-approved
> bank link and records the initiation event. If no issuer bank
> reference has been captured, bank reference is visibly unavailable.
>
> **5.** Before any accepted matching MIS, bank status is **Awaiting MIS
> Update**, not 'Application Submitted' or 'Under Processing'.
>
> **6.** Admin uploads HDFC MIS. A row with a reliable exact reference
> matches the lead. Show, for example, CURRENT_STAGE = Decisioned Cases,
> FINAL_DECISION = Approve, Card Activation Staus = INACTIVE **as three
> separate fields**. These are illustrative source values, not a
> generated status path.
>
> **7.** When a later MIS reports a different field, update just the
> supplied bank information under the bank profile's agreed full/delta
> semantics, append true source-backed change history and update
> Advisor/Manager/Admin views.
>
> **8.** Bank reasons/remarks remain literal MIS content, KBS follow-up
> notes remain operational; eligible payout appears only after
> configured issuer activation-event evidence and payout policy are
> satisfied.

## 26.3 Advisor payout and Accounts settlement

> **1.** A bank MIS update confirms a qualifying activation event for an
> Advisor-owned, uniquely identified card under approved bank-specific
> payout rules.
>
> **2.** Advisor sees the event in Available Payouts and requests
> payment for the selected eligible card(s); they become reserved
> immediately.
>
> **3.** Relevant Manager and Admin each review and approve the same
> itemized request; Accounts sees it only after both approvals.
>
> **4.** Accounts pays outside KBS and uploads transfer details/proof.
> KBS records external payment and marks the same entitlement as paid.
>
> **5.** Advisor's available payable-card count decreases by
> paid/reserved entitlements, while historical MIS activation count
> stays accurate; a second request for the same entitlement is blocked.

## 26.4 Missing and conflicting MIS

A new KBS lead has no bank reference or no MIS match: display **Awaiting
MIS Update**. A prior matched lead is absent from today's bank sheet:
preserve previous actual reported values and show that this lead's last
matched MIS was older. A bank row has two plausible candidate leads or
duplicate inconsistent values: quarantine as conflict for Admin and do
not choose by customer name. A blank activation field means 'Not
reported', not 'INACTIVE'. No fabricated follow-up CTA is generated by a
blank.

# 27. Detailed functional acceptance criteria / QA test matrix

The following tests are intended to become executable QA cases;
placeholders marked OPEN must be bound to KBS-approved values before
formal sign-off.

| **ID**   | **Scenario and expected result**                                                                                                                          |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| AUTH-01  | Every role signs in using registered mobile + valid OTP; password/email login is not required or offered.                                                 |
| AUTH-02  | OTP expiry, wrong code, resend and rate-limiting handled without exposing another account.                                                                |
| RBAC-01  | Telecaller sees own assigned customers only; Manager sees own team; Admin organization-wide; Advisor own leads; Accounts approved payout data only.       |
| RBAC-02  | Direct API/deep-link attempt to another user's lead, PAN, recording, cheque or proof is denied server-side.                                               |
| TRAIN-01 | Manager alone creates Telecaller with name/number; assigned Manager and company ID generated.                                                             |
| TRAIN-02 | First successful Telecaller login stores one 72-hour deadline; repeat login cannot reset it.                                                              |
| TRAIN-03 | All three video/MCQ modules must be passed in order before calling queue is accessible.                                                                   |
| TRAIN-04 | A Telecaller with incomplete module after 72 hours is deactivated and cannot access customer data.                                                        |
| TRAIN-05 | Assigned Manager reactivates failed Telecaller; next screen is first uncleared module; earlier passes persist.                                            |
| TRAIN-06 | Another Manager cannot reactivate a Telecaller outside their reporting team.                                                                              |
| CUST-01  | Admin imports sample headers NAME, PAN NO, MOBILE, Pincode; no nonexistent Location column is assumed.                                                    |
| CUST-02  | Uploaded records validated, duplicate/invalid/suppressed rows reported, accepted records assigned to eligible trained Telecallers.                        |
| CUST-03  | Reimporting same customer list does not erase prior assignment, do-not-contact or call history.                                                           |
| CUST-04  | Follow-up customer remains in active follow-up; completed/declined customer can be hidden without deletion.                                               |
| PIN-01   | All nine supplied bank sheet structures are importable via bank-specific profiles with original fields preserved.                                         |
| PIN-02   | Unknown sourcing flag does not create an automatically available card; pincode not found displays no supported sourceability, not personal ineligibility. |
| PIN-03   | Pincode match preserves zeros, respects bank/channel flags, displays linked Admin card details/PDF/URL when configured.                                   |
| CARD-01  | Advisor can browse/search/filter by issuer/category, open accurate benefits/fees/disclosures and select card.                                             |
| CALL-01  | Telecaller initiates call from app; actual provider result/call ID and duration when available are attached to correct customer.                          |
| CALL-02  | When recording exists it is playable by authorized Manager/Admin; recording failure never displays 'recorded'.                                            |
| CALL-03  | Card benefits, official ID, PDF, link and remarks remain reachable within the customer calling context.                                                   |
| WA-01    | PDF, official ID and card link are individually shareable; 'share sheet opened' is not called 'delivered'.                                                |
| WA-02    | Exact published URL and tracking parameters are preserved; link-sharing activity is recorded against customer/card.                                       |
| CALL-04  | Interest/follow-up/decline recorded as **operational** outcome and does not set bank final decision or activation.                                        |
| SEC-01   | Telecaller customer actions blocked outside approved office context unless valid WFH exception; Advisor offsite use remains allowed.                      |
| SEC-02   | Android app applies supported protected-screen controls; security test notes residual external capture limitations.                                       |
| FOS-01   | Advisor signs up by OTP/name/mobile/email and completes required identity/bank/cheque workflow under approved compliance rules.                           |
| FOS-02   | Valid Agent Code assigns correct parent; blank code maps to Admin; adding code later is available with explicit attribution policy.                       |
| FOS-03   | Advisor guided lead captures mobile, details, PAN, pincode/location, employment/ITR income, declarations and review.                                      |
| FOS-04   | Internal submission generates a KBS lead only; sharing an issuer link does not set bank 'Submitted', 'Approve' or activation.                             |
| FOS-05   | PAN verify mismatch, missing consent and invalid customer field produce editable errors, not a false completed lead.                                      |
| FOS-06   | Advisor sees own My Leads, search/filters/detail, and can always distinguish operational history from bank MIS history.                                   |
| MIS-01   | Admin MIS upload validates expected bank-specific mapping, rows and references and shows import-preview anomalies.                                        |
| MIS-02   | HDFC stage = Decisioned Cases, decision = Approve, activation = INACTIVE appear independently and verbatim.                                               |
| MIS-03   | HDFC Card Activation Staus = \#N/A displays 'Not reported', with no activation payout eligibility inferred.                                               |
| MIS-04   | KBS lead not yet present in MIS displays 'Awaiting MIS Update', never a fabricated bank stage.                                                            |
| MIS-05   | Previous bank-matched lead missing in newest MIS retains last accepted values and its own last matching batch date.                                       |
| MIS-06   | Distinct original remarks from DROPOFF_REASON, DECLINE_DESCRIPTION, Decline Descreption, Decline Type, Reason etc. remain individually viewable.          |
| MIS-07   | Bank status cannot be edited from Telecaller, Advisor, Manager, Admin direct lead edit or Accounts workflows; only accepted MIS processing changes it.    |
| MIS-08   | Reupload identical MIS does not duplicate change history, notifications, activation event or payout.                                                      |
| MIS-09   | Unmatched/ambiguous references and contradictory duplicates are quarantined rather than guessed by customer name.                                         |
| MIS-10   | A valid later bank correction produces a new source-backed historical snapshot with reported date separated from upload time.                             |
| MIS-11   | Unknown bank values are preserved pending mapping; no silent Approve/Activated synonym guess.                                                             |
| VIEW-01  | Web table/mobile lead cards show distinct Stage, Decision, Activation, remarks and per-lead last matched MIS date.                                        |
| VIEW-02  | No fixed Lead Created -\> Processing -\> Approved timeline appears as a falsely bank-confirmed path.                                                      |
| VIEW-03  | Pending actions represent supported actual bank instructions or explicitly logged KBS tasks with source and owner if known.                               |
| DASH-01  | Calling attempts, links shared, operational leads, bank decisions and MIS activations are separate KPIs with date/source.                                 |
| DASH-02  | Manager team scope and Admin org scope yield consistent underlying totals when filtered to same population/time.                                          |
| PAY-01   | Approval/card setup without configured MIS payout event cannot create available payout entitlement.                                                       |
| PAY-02   | Eligible card selected in a submitted request is reserved; second session cannot claim it concurrently.                                                   |
| PAY-03   | Both Manager and Admin decisions exist before request appears in Accounts payment-ready queue.                                                            |
| PAY-04   | Admin-direct Advisor cannot bypass the independent Manager approval requirement.                                                                          |
| PAY-05   | Accounts records **external** transfer and uploads proof; KBS itself does not transfer money.                                                             |
| PAY-06   | Paid entitlement no longer claimable; MIS activation count/history unchanged; itemized card/request/payment trace exists.                                 |
| PAY-07   | Wrong amount, absent proof, double transaction reference and later MIS correction route to visible exceptions, not silent double payout.                  |
| NOTIF-01 | MIS status-change notification reports exact changed field/source time and deep-links only for authorized recipient.                                      |
| NOTIF-02 | Request approvals/payment notifications reach relevant Advisor/Manager/Admin/Accounts without leaking PAN or full bank account.                           |
| AUDIT-01 | User access changes, uploads, assignment, training reactivation, bank correction, each approval and payment retain source/actor/time.                     |

# 28. Open decisions, dependency owners and launch gates

The following items are not missing from the PRD; they are **genuinely
unspecified business or contract facts** in the supplied source.
Engineering must not fill them with undocumented guesses. Owners are
proposed functional owners, not named individuals.

| **Priority** | **Decision / why it matters**                                                                                                                                     | **Proposed owner / required resolution**                                                |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| P0           | Exact identifier returned by each issuer/link so a KBS Advisor lead can match MIS without name/mobile guessing.                                                   | Bank partnerships + Admin: test issuer journeys and approve reference linkage per bank. |
| P0           | Which bank MIS field/value proves a commission-eligible **activation event** for each bank; HDFC V + ACTIVE vs TXN ACTIVE - Rs 100 vs payout settlement criteria. | Finance + bank partnerships: signed per-bank payout rule/version and examples.          |
| P0           | Per-bank payout rates, rate effective dates, payout eligibility hold, duplicate/reissued card event identity and rate-change treatment.                           | Owner/Admin + Finance: approved commercial rate schedule and card-event key.            |
| P0           | Both approvals for Advisor with **Admin as direct parent**; no Manager is naturally assigned.                                                                     | Owner/Admin: designate independent Manager approver and auditable route.                |
| P0           | Eligibility for purchased third-party customer list, DND/suppression checks, lawful consent, call timing, record retention/recording disclosure and WhatsApp use. | Compliance + telephony/communications provider: written SOP before activation.          |
| P0           | Permissible Aadhaar verification mode and vendor/entity authorization; PAN and payout-bank verification mode.                                                     | Compliance + onboarding: provider agreements, consent text, data scope/retention.       |
| P0           | Telephony provider feasibility of in-app originating/bridging, automatic legal recording, caller ID, recordings retrieval and full current pricing.               | Engineering + operations: proof of concept and vendor quote.                            |
| P0           | Bank MIS file semantics: full snapshot versus delta, blank cell meaning, conflicting row ordering, bank timezone and corrections.                                 | Bank operations + Admin: one approved profile per bank.                                 |
| P1           | Admin-card catalogue source: actual issuer/card product inventory, benefits PDFs, accurate fees, active links and product-code-to-pincode mapping.                | Product/Bank operations: approved canonical card entries.                               |
| P1           | Agent Code points to Manager or another person; effect of later code change on old vs future leads, reserved/paid payouts and approvals.                          | Owner/Admin + Finance: effective-dated attribution policy.                              |
| P1           | Telecaller training passing formula, video completion, retry limits and exact new deadline after Manager reactivation.                                            | Operations + training Admin: approved configuration.                                    |
| P1           | Calling-record dedup key, allocation policy, reassignment and lead-collision rules with an Advisor on same customer.                                              | Admin/Operations: explicit record ownership and reporting rules.                        |
| P1           | Official Telecaller ID card fields/verification, expiration/revocation and customer share rules.                                                                  | Admin + compliance: approved card template.                                             |
| P1           | WFH network policy: authorized office egress IPs, dynamic IP/VPN, exception duration, device security and offline handling.                                       | IT/security + Admin: enforceable access policy.                                         |
| P1           | Payment rejection/cancellation/reservation release, partial payments, payout disputes and correction workflow (without building clawbacks).                       | Finance + Admin: approved finite-state payment SOP.                                     |
| P1           | Current user load, number of records/day, calls/month, file sizes, document/recording retention, report refresh and response thresholds.                          | Owner/Admin + operations/engineering: capacity and acceptance targets.                  |
| P2           | Exact Manager/Accounts creation and general account-disable permissions; optional Admin/Accounts mobile access.                                                   | Owner/Admin: access matrix final sign-off.                                              |
| P2           | Optional customer-facing follow-up messaging, notification channels, escalation/quiet hours and export/print policy.                                              | Product/Compliance: approved channel/permissions policy.                                |

## 28.1 Vendor selection and cost analysis workstream (bounded scope)

The original request asks for reliable low-cost third-party
integrations. Compare **only support services actually needed**: OTP
(unit price, resend and fraud controls), lawful Aadhaar/PAN/bank
verification (per check, retries and regulatory authorization),
telephony (connected vs attempted minute billing, number rental,
call-bridging, recording/storage/retrieval, SLA, recordings consent) and
WhatsApp (app hand-off vs Business Platform media/template/session
pricing, document hosting, template approval and delivery reports).
Collect dated, written India-market vendor quotes and forecast cost
using KBS's actual monthly user/verification/call/message volumes. No
unverified price or vendor is mandated in this PRD. **Do not** add an
aggregator/bank activation-status API: MIS remains the bank-status
source of truth.

## 28.2 Release gates

No production calling until consent/DND/recording/office-network
safeguards and approved provider are operational. No live Aadhaar flow
until lawful mode and processing agreements are approved. No automatic
Advisor payout eligibility until bank-specific MIS trigger, reference
matching, approved commercial rate and Admin-direct dual-approval
routing are configured and tested. All three sample workbook schemas
must pass import QA before the upload workflow is considered validated;
live bank files may require additional per-bank profiles.

# 29. Requirement traceability checklist

| **Original or later user requirement**                                                                                                                     | **Coverage in this PRD**   |
|------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------|
| Credit-card-only DSA, React Native Android APK plus Admin web; English; Managers on both platforms                                                         | Sections 1-3, 20, 25.      |
| Use shadcn/ui, not Tamagui; highly impressive intuitive consistent web/mobile UX                                                                           | Sections 0.2, 20, 25.      |
| All roles mobile OTP only; Admin sees everything; team hierarchy                                                                                           | Sections 3-4.              |
| Only Manager creates Telecaller, name+mobile, 72-hour three-module video/MCQ training, Manager reactivation at failed module                               | Sections 5, 25, 27.        |
| Admin uploaded customer calling list, automatic distribution, customer name/mobile/pincode/location                                                        | Sections 6, 25-27.         |
| In-app calls, automatic authorized recordings, live card details, official ID, WhatsApp PDFs and bank links                                                | Sections 7-8, 25-27.       |
| Telecaller outcome/follow-up/declined/completed hidden not deleted; no Telecaller card commission                                                          | Sections 6, 8, 15-16.      |
| Office Wi-Fi Telecaller only, Manager/Admin WFH, screenshots restricted                                                                                    | Sections 9, 21, 27.        |
| Advisor self-signup, Aadhaar, bank details, cancelled cheque, Agent Code optional/later; blank -\> Admin                                                   | Sections 3, 10, 25-28.     |
| Full FOS browse/card/customer PAN/pincode/employment/ITR/declarations/review and all 29 original screens                                                   | Sections 7, 11-12, 25-27.  |
| Corrected FOS: initiate issuer link, then only uploaded MIS supplies application current stage/decision/activation/bank remarks; no fixed bank-status flow | Sections 0, 11-14, 26-27.  |
| Three uploaded Excel categories; actual per-bank pincode columns; HDFC status and remark columns                                                           | Sections 6-7 and 13-14.    |
| Daily / 1-3 day MIS import automatically updates every role and accurate reports                                                                           | Sections 13-16 and 19, 27. |
| Manager/Admin total attempts, success/failure, call recordings, operational and activation business dashboards                                             | Sections 15-16.            |
| Advisor activation-based payout; both Manager and Admin approve; Accounts pays outside app and uploads proof; paid cards unavailable for repeat claim      | Sections 17-18, 26-28.     |
| Exclude loans, iOS initial release, targets, leaderboards, incentives, upline commissions, TDS/GST statements and clawbacks                                | Section 2.                 |

# 30. Source inventory and references

## 30.1 User-supplied business sources

> **1.** Pasted text.txt — original KBS role/workflow descriptions,
> original FOS 29-screen narrative and subsequent decisions superseding
> several earlier ideas.
>
> **2.** offline_cards_20_jaipur_pincodes(1).xlsx — customer calling
> sample; headings NAME, PAN NO, MOBILE, Pincode; no separate Location
> heading.
>
> **3.** 10_records_each_bank(1).xlsx — nine bank-specific pincode
> worksheet examples; bank-specific headers and flags, not a complete
> card catalogue or activation MIS.
>
> **4.** KBS804%20HDFC%20MIS_recreated(1).xlsx — HDFC example with 36
> exact headers, separate CURRENT_STAGE, FINAL_DECISION, Card Activation
> Staus, KYC and bank reason columns.
>
> **5.** Two original user-supplied partner URLs listed in Section 7.5;
> use only after Admin associates each with an approved
> bank/card/channel and confirms current validity.

## 30.2 External implementation/compliance references (not additional business requirements)

> **•** Official shadcn/ui docs and web component model:
> https://ui.shadcn.com/docs and monorepo guidance
> https://ui.shadcn.com/docs/monorepo.
>
> **•** React Native shadcn-style registry example (independent project;
> evaluate suitability rather than silently mandate):
> https://reactnativereusables.com/docs/changelog.
>
> **•** UIDAI paperless offline e-KYC guidance:
> https://uidai.gov.in/en/307-faqs/authentication/offline-aadhaar-data-verification-service.html.
>
> **•** TRAI commercial communication sender guidance:
> https://www.trai.gov.in/advice-to-senders and
> https://www.trai.gov.in/tcccpr.
>
> **•** Android playback/capture restrictions and protected-screen
> context: https://developer.android.com/media/platform/av-capture.

**End of complete PRD.** The OPEN items are explicit, necessary
production decisions; they are not permission to abandon or replace any
of the confirmed KBS workflows or the single-source-of-truth MIS rule.
