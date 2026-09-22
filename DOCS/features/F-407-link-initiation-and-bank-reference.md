# F-407 Application-link initiation and bank reference linkage

- Group: Advisor · Status: **PLANNED** · Depends on: F-406, F-311, F-403 · ADR-007
- PRD refs: REQ-11 §11.6 (share/open Admin-approved issuer link; preserve tracking/version; record events; capture bank reference only via supported mechanism; otherwise 'Bank application reference not yet available'; never 'Application Submitted' from a share), REQ-12 S22, REQ-13 §13.5 (exact reference; no name/mobile auto-match), REQ-26 §26.2 steps 4–5
- QA ids: FOS-04, MIS-04, MIS-09

## Detailed requirements
1. `POST /leads/:id/link/share` and `/link/open` → `LeadLinkInitiation(action, applicationLinkId, linkVersion, at)`; share uses F-311 with target LEAD. UI label after: "Application link shared (KBS activity)" — provenance KBS_OPERATIONAL; bank status untouched.
2. `POST /leads/:id/bank-reference {referenceKind, referenceValue}` (Advisor own lead; Admin any) → `BankApplicationLinkage(source=ADVISOR_ENTERED|ADMIN_ENTERED, verificationStatus=UNVERIFIED)`; exact string (trim ends only); unique per bank+kind+value — if the value already belongs to another lead → `CONFLICT` "This reference is already linked to another lead; contact Admin" (no details leaked).
3. Lead detail shows "Bank application reference: not yet available" until a linkage exists; then shows value with status `Unverified` / `Verified by MIS match`.
4. Advisor may correct an UNVERIFIED reference (history kept); VERIFIED references are immutable except by Admin review flow (F-504).

## Acceptance criteria
- [ ] FOS-04: link share leaves display "Awaiting MIS Update".
- [ ] Reference stored exactly (`'0012345'` keeps zeros; case preserved).
- [ ] Duplicate reference across leads refused.
