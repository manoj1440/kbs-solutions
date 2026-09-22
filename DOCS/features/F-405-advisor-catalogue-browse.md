# F-405 Advisor card discovery: catalogue, categories, search, filters, detail

- Group: Advisor · Status: **DONE** · Depends on: F-403, F-404, F-802
- PRD refs: REQ-11 §11.2 (Credit Card Home), §11.3, REQ-12 S08–S12, REQ-07 §7.4, REQ-20 §20.4
- QA ids: CARD-01

## Detailed requirements
1. `GET /catalogue/cards?category&bankId&q&pincode?&sort` → PUBLISHED cards with effective ADVISOR link; optional pincode narrows to sourceable banks and annotates `sourceableAtPincode: true|false|unknown` with provenance (bank upload batch date).
2. Home (S08): search entry, category chips, Create Lead, My Leads, Pending Actions count (F-409), notifications, payouts entry; counts labelled by provenance ("Operational leads: N", "MIS-confirmed activations: M").
3. Detail (S12): image, bank, categories, benefits, fees, charges, eligibility highlights, disclosures, PDF, "Sourcing availability" section (by pincode input), CTA "Create Lead for customer".

## Acceptance criteria
- [x] CARD-01: browse/search/filter/detail/select flows on mobile with fixture data.
- [x] No copy anywhere says or implies guaranteed approval (snapshot test of strings).

## Progress notes
- 2026-09-22 (session 3): `GET /cards/browse?category&bankId&q&pincode&sort` (CATALOGUE_READ + onboarding gate): PUBLISHED cards of active banks with an effective ADVISOR (or BOTH) link; with `pincode`, every card is annotated `sourceableAtPincode: true | false | 'unknown'` (unknown = bank has no approved+imported pincode data; absent row under live data = false) plus `sourceabilityProvenance {sourceability, batchUploadedAt}` — cards are never hidden so the Advisor sees why. Mobile: `(advisor)/index.tsx` home (search, pincode field, category chips, list with sourcing badge, My leads entry), `(advisor)/card.tsx` detail (image, benefits, fees, charges, eligibility, disclosures, PDF, "Sourcing availability" check by pincode, "Create lead for a customer" CTA → F-406), `(advisor)/profile.tsx` with Agent Code change (F-402 §2, shows APPLIED vs PENDING_APPROVAL). `leads`/`lead-new` are placeholders until F-408/F-406. Pending Actions / payouts / notifications counters on Home arrive with F-409/F-6xx/F-701. e2e: browse filters + annotation + gate, and a snapshot test that no mobile/shared string contains approval-guarantee phrasing.
