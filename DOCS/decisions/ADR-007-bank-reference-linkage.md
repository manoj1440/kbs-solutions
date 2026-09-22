# ADR-007: Bank reference capture and linkage sources

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-11 §11.6, REQ-13 §13.5, REQ-28 P0 #1, INV-08

## Decision
`BankApplicationLinkage` records where a bank reference came from: `ADVISOR_ENTERED` (Advisor types the application number the customer received from the issuer), `ADMIN_ENTERED`, `ISSUER_CALLBACK` (only if a bank ever provides one), `MIS_RESOLVED_BY_ADMIN` (Admin links an UNMATCHED MIS row to a lead in the review flow). A linkage is `UNVERIFIED` until an MIS row with the identical `(bankId, referenceKind, referenceValue)` matches; then `VERIFIED_BY_MIS_MATCH`. Reference strings are stored exactly (leading zeros, case preserved, whitespace trimmed only at the ends).

The lead's bank status still comes exclusively from MIS. The linkage only tells the matcher which lead an MIS row belongs to.

## Consequences
Removes the launch blocker for matching without name/mobile guessing. Advisor-entered references that never match are visible on the Admin MIS-integrity dashboard.
