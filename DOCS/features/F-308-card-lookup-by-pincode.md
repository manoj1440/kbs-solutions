# F-308 Card lookup by customer pincode (sourceability ∩ publication)

- Group: Telecaller ops · Status: **PLANNED** · Depends on: F-403, F-404, F-307
- PRD refs: REQ-07 §7.4 (customer pincode → bank/card combos permitted by bank-specific mapping AND published by Admin; card image/bank/name/category/PDF/charges/features/link; 'No card available for this pincode from current uploaded data' — never 'ineligible'), §7.1 (sourceable ≠ offered ≠ qualifies), REQ-08 §8.3, REQ-25 §25.2 (Card Detail in Call)
- QA ids: PIN-02, PIN-03, CALL-03

## Detailed requirements
1. `GET /cards/available?pincode=&channel=TELECALLER|ADVISOR` → cards where: bank has a `SOURCEABLE` row for that pincode under the bank's **approved** profile/latest batch, AND the card is `PUBLISHED`, AND a `CardPincodePublication` covers the pincode (exact) or state (via PincodeMaster) or is global for that channel, AND an `ApplicationLink` for the channel is effective now. Include the raw bank sourceability flags for display in detail (provenance: bank pincode upload, with batch date).
2. Empty result → `{cards: [], message: 'No card available for this pincode from current uploaded data', asOf}`.
3. `REQUIRES_BANK_MAPPING` rows never count as sourceable (PIN-02).
4. Calling-desk card list and detail (mobile): image, bank, name, categories, key benefits, fees, charges, PDF button, link version; share actions (F-311) accessible without leaving the call context (CALL-03).

## Acceptance criteria
- [ ] PIN-02/03 fixtures: sourceable + published → shown; sourceable + unpublished → hidden; ambiguous flag → hidden; unknown pincode → empty message text exact.
