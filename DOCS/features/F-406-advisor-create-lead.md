# F-406 Advisor creates customer operational lead (multi-step)

- Group: Advisor · Status: **PLANNED** · Depends on: F-405, F-304, F-109, F-107
- PRD refs: REQ-11 §11.1 (flow), §11.4 (exact fields: customer mobile → details/name → PAN entry + verification state → residence pincode + confirmed city/state → employment Salaried/Self Employed/Self Employed Professional → annual income per ITR → declarations + Credit Bureau acknowledgement + consent → review → submit; step errors; keep selected card; avoid duplicate customers; KBS lead reference), §11.5, REQ-12 S13–S20, REQ-23 §23.4, INV-01
- QA ids: FOS-03, FOS-04, FOS-05

## Detailed requirements
1. Draft model: `LeadDraft` stored server-side (`PATCH /leads/drafts/:id/<step>`) so a killed app resumes; selected card fixed at draft creation; draft expires after 7 days.
2. Steps: `MOBILE` (E.164; warn if an own lead for same mobile + card exists in last 30 days — duplicate guard, override with reason) → `DETAILS` (fullName; optional email/dob per config) → `PAN` (`normalizePan`; `PanVerificationProvider.verify` → status shown as `VERIFIED | MISMATCH | FAILED | UNAVAILABLE`; on MISMATCH the step blocks with edit; on UNAVAILABLE proceed allowed only if `leads.allowUnverifiedPan=true` (default false, OPEN)) → `PINCODE` (F-304 pre-fill; user confirms city/state or marks unavailable) → `EMPLOYMENT` (enum of three) → `INCOME` (annual income as per ITR, INR, decimal) → `DECLARATIONS` (versioned texts from config `leads.declarations[]`, all required; Credit Bureau acknowledgement checkbox with timestamp) → `REVIEW` → `SUBMIT` with `Idempotency-Key` → `Lead` row with `publicRef`, `reportingParentUserIdSnapshot`, encrypted PAN, and **no** `BankStatusSnapshot` (so status is Awaiting MIS Update).
3. Success (S20): KBS reference, customer, card, issuer, CTAs: Share application link (F-407), View Lead, Create Another, My Leads, Home. Copy: "This creates a KBS lead only; bank status will appear after MIS upload."
4. Mobile screens S13–S20 with stepper, inline validation, back/edit from review.

## Acceptance criteria
- [ ] FOS-03: all fields captured and persisted; enum limited to the three types.
- [ ] FOS-04: after submit, `GET /leads/:id` shows stage/decision/activation = "Awaiting MIS Update" (display) and no bank fields set.
- [ ] FOS-05: PAN mismatch, missing declaration, invalid mobile → step errors; no lead row created.
- [ ] Double submit with same key → one lead.
