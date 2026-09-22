# F-308 Card lookup by customer pincode (sourceability ∩ publication)

- Group: Telecaller ops · Status: **DONE** · Depends on: F-403, F-404, F-307
- PRD refs: REQ-07 §7.4 (customer pincode → bank/card combos permitted by bank-specific mapping AND published by Admin; card image/bank/name/category/PDF/charges/features/link; 'No card available for this pincode from current uploaded data' — never 'ineligible'), §7.1 (sourceable ≠ offered ≠ qualifies), REQ-08 §8.3, REQ-25 §25.2 (Card Detail in Call)
- QA ids: PIN-02, PIN-03, CALL-03

## Detailed requirements
1. `GET /cards/available?pincode=&channel=TELECALLER|ADVISOR` → cards where: bank has a `SOURCEABLE` row for that pincode under the bank's **approved** profile/latest batch, AND the card is `PUBLISHED`, AND a `CardPincodePublication` covers the pincode (exact) or state (via PincodeMaster) or is global for that channel, AND an `ApplicationLink` for the channel is effective now. Include the raw bank sourceability flags for display in detail (provenance: bank pincode upload, with batch date).
2. Empty result → `{cards: [], message: 'No card available for this pincode from current uploaded data', asOf}`.
3. `REQUIRES_BANK_MAPPING` rows never count as sourceable (PIN-02).
4. Calling-desk card list and detail (mobile): image, bank, name, categories, key benefits, fees, charges, PDF button, link version; share actions (F-311) accessible without leaving the call context (CALL-03).

## Acceptance criteria
- [x] PIN-02/03 fixtures: sourceable + published → shown; sourceable + unpublished → hidden; ambiguous flag → hidden; unknown pincode → empty message text exact.

## Progress notes
- 2026-09-22 (session 2): `CardAvailabilityService.available(pincode, channel)`: bank SOURCEABLE under approved profile/latest batch (REQUIRES_BANK_MAPPING never counts) ∩ card PUBLISHED + bank active ∩ `CardPincodePublication` (channel or BOTH; exact pincode > state via PincodeMaster > global; most specific wins) ∩ `CatalogueService.effectiveLink` for the channel. Empty → `{cards: [], message: 'No card available for this pincode from current uploaded data', asOf}` exactly. Each card carries `provenance` (sourceability, batchId, batchUploadedAt, raw bank flags, publication scope) and `link {id, version, channel}`. Routes: `GET /cards/available?pincode&channel` (CATALOGUE_READ, gates), `GET /calling/records/:id/cards` (scoped like the queue), Admin `GET/POST /catalogue/cards/:id/publications`, `POST /catalogue/publications/:id/end`. Web card editor has an "Where this card is offered" section. Mobile: record screen lists cards for the pincode; `(telecaller)/card.tsx` detail (image via presigned URL, benefits, fees, charges, eligibility, disclosures, PDF open, provenance; WhatsApp share button disabled until F-311). e2e `card-availability.e2e-spec.ts`.
