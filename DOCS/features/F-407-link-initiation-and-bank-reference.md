# F-407 Application-link initiation and bank reference linkage

- Group: Advisor · Status: **DONE** · Depends on: F-406, F-311, F-403 · ADR-007
- PRD refs: REQ-11 §11.6 (share/open Admin-approved issuer link; preserve tracking/version; record events; capture bank reference only via supported mechanism; otherwise 'Bank application reference not yet available'; never 'Application Submitted' from a share), REQ-12 S22, REQ-13 §13.5 (exact reference; no name/mobile auto-match), REQ-26 §26.2 steps 4–5
- QA ids: FOS-04, MIS-04, MIS-09

## Detailed requirements
1. `POST /leads/:id/link/share` and `/link/open` → `LeadLinkInitiation(action, applicationLinkId, linkVersion, at)`; share uses F-311 with target LEAD. UI label after: "Application link shared (KBS activity)" — provenance KBS_OPERATIONAL; bank status untouched.
2. `POST /leads/:id/bank-reference {referenceKind, referenceValue}` (Advisor own lead; Admin any) → `BankApplicationLinkage(source=ADVISOR_ENTERED|ADMIN_ENTERED, verificationStatus=UNVERIFIED)`; exact string (trim ends only); unique per bank+kind+value — if the value already belongs to another lead → `CONFLICT` "This reference is already linked to another lead; contact Admin" (no details leaked).
3. Lead detail shows "Bank application reference: not yet available" until a linkage exists; then shows value with status `Unverified` / `Verified by MIS match`.
4. Advisor may correct an UNVERIFIED reference (history kept); VERIFIED references are immutable except by Admin review flow (F-504).

## Acceptance criteria
- [x] FOS-04: link share leaves display "Awaiting MIS Update".
- [x] Reference stored exactly (`'0012345'` keeps zeros; case preserved).
- [x] Duplicate reference across leads refused.

## Progress notes
- 2026-09-22 (session 3): `POST /leads/:id/link/{share,open}` → `LeadLinkInitiation(action, applicationLinkId, linkVersion)` for the current effective ADVISOR link; response carries the verbatim URL (for OPENED the app launches it) and the label "Application link shared/opened (KBS activity)"; bank status untouched and no "Application Submitted" wording anywhere. WhatsApp sharing with `targetType: LEAD` goes through F-311 and is listed under the lead. `POST /leads/:id/bank-reference {referenceKind, referenceValue}` (Advisor own / Admin any; LEAD_BANK_REFERENCE_ENTER): trims ends only, case + leading zeros preserved; unique per bank+kind+value — another lead's value → 409 "already linked to another lead; contact Admin" with no details; correction supersedes the previous row (history kept, `supersededAt`); `VERIFIED_BY_MIS_MATCH` references are immutable for Advisors. Mobile lead detail shows "Bank application reference not yet available" → value with Unverified / Verified by MIS match badge and earlier values.
