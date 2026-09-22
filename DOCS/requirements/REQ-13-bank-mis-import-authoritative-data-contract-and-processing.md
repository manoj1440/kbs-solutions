<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

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

| **#** | **Exact Excel column**       | **Requirement / semantic group**                                                                                |
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
> TXN ACTIVE - Rs 100, and #N/A.
>
> **•** KYC Status sample values include Expired, NR, Not Eligible,
> Success; VKYC_STATUS includes VKYC InComplete and vKYC Success; BKYC
> Status includes Closed, Completed and #N/A.
>
> **•** Decline/reason fields may have #N/A, an internal code,
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
| A status cell is blank or #N/A                          | Show Not reported for that field; preserve raw cell and distinguish unknown from negative result. Whether blank supersedes a previously known value depends on an expressly configured full-snapshot vs delta-file rule (OPEN). |
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
