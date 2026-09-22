# F-405 Advisor card discovery: catalogue, categories, search, filters, detail

- Group: Advisor · Status: **PLANNED** · Depends on: F-403, F-404, F-802
- PRD refs: REQ-11 §11.2 (Credit Card Home), §11.3, REQ-12 S08–S12, REQ-07 §7.4, REQ-20 §20.4
- QA ids: CARD-01

## Detailed requirements
1. `GET /catalogue/cards?category&bankId&q&pincode?&sort` → PUBLISHED cards with effective ADVISOR link; optional pincode narrows to sourceable banks and annotates `sourceableAtPincode: true|false|unknown` with provenance (bank upload batch date).
2. Home (S08): search entry, category chips, Create Lead, My Leads, Pending Actions count (F-409), notifications, payouts entry; counts labelled by provenance ("Operational leads: N", "MIS-confirmed activations: M").
3. Detail (S12): image, bank, categories, benefits, fees, charges, eligibility highlights, disclosures, PDF, "Sourcing availability" section (by pincode input), CTA "Create Lead for customer".

## Acceptance criteria
- [ ] CARD-01: browse/search/filter/detail/select flows on mobile with fixture data.
- [ ] No copy anywhere says or implies guaranteed approval (snapshot test of strings).
