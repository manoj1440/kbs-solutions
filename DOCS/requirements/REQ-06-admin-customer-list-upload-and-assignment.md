<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

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

Admin selects customer-list upload -> selects appropriate file/sheet
-> sees header mapping and preview without unnecessary full PAN/mobile
exposure -> validates required fields and eligible contact records ->
reviews duplicate/conflict report -> confirms import -> receives
imported/rejected/skipped totals and an immutable batch reference ->
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
