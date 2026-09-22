# F-403 Bank and credit-card catalogue administration

- Group: Advisor · Status: **DONE** · Depends on: F-108, F-104
- PRD refs: REQ-07 §7.1 (Admin maintains image/name/issuer, description, categories, rewards/benefits, joining/annual fees, major charges, eligibility highlights, disclosures, application URL, benefit PDF), §7.4 (categories Travel, Shopping, Premium/Top, Fuel, other configurable), §7.5 (seed links; assign to bank/card/channel with effective dates; preserve tracking strings), REQ-11 §11.3 (no guaranteed-approval wording), REQ-13 §13.2 #18/#31 (product-code crosswalk), REQ-16 §16.1, REQ-28 P1
- QA ids: CARD-01, WA-02, PIN-03

## Detailed requirements
1. `Bank` CRUD (code, name, active). Seeded with the ten banks named in the PRD.
2. `CreditCard` CRUD with `DRAFT → PUBLISHED → RETIRED`; version increments on publish; fields as REQ-07 §7.1; image + PDF via files module; categories many-to-many; marketing copy linter warns on phrases like "guaranteed approval", "instant approval", "eligible for sure" (blocklist in config `catalogue.forbiddenPhrases`).
3. `ApplicationLink` per card and channel with `effectiveFrom/To`, stored verbatim (no normalisation, no trailing-slash changes); history of versions; only one effective link per (card, channel) at a time.
4. `ProductCodeCrosswalk` (bank MIS product code/description → card) confirmed by Admin — used by MIS display (F-506) to show the catalogue card next to the bank's product text.
5. Seed data: the two example URLs from §7.5 as **DRAFT** links attached to placeholder DRAFT cards "Popcard partner (example)" and "AU Bank (example)" so nothing is published by accident.
6. Admin web screens: Banks, Cards table (status/version/bank/categories), Card editor (tabs: basics, benefits/fees, disclosures, assets, links, publication F-404), Crosswalk table.

## Acceptance criteria
- [x] Publishing a card with a forbidden phrase requires explicit override with reason (audited).
- [x] WA-02: stored link equals input including `utm_*` and `#fragment`.
- [x] Only PUBLISHED cards with an effective link appear in F-308/F-405.

## Progress notes
- 2026-09-22 (session 2): API `/catalogue/*`: banks (list/create/patch active), categories, cards (list/create/get/patch/publish/retire), links (`POST /catalogue/cards/:id/links` stored verbatim incl. utm/fragment/trailing space; adding a link closes any overlapping effective link on the same channel or BOTH → exactly one effective per channel; `POST /catalogue/links/:id/end` with reason), crosswalks (`GET/POST /catalogue/crosswalks`, same-bank check). Publish runs the forbidden-phrase linter over name/description/benefits/eligibility/disclosures using `catalogue.forbiddenPhrases`; hits → 400 with `details.forbiddenPhrases`; `overrideReason` publishes anyway, stored in `forbiddenPhraseOverride`, audited (`card.publish`). Re-publishing a PUBLISHED card bumps `version`. `effectiveChannels` + per-link `live` returned for UI/F-308. `CatalogueService.effectiveLink(cardId, channel)` is the single resolver for "which URL to use now". Admin web `/admin/catalogue` (banks, new card/bank, cards table) and `/admin/catalogue/[id]` (editor: basics/benefits/fees/charges/eligibility/disclosures/categories, assets via files module, links with end, publication with override, retire). e2e `catalogue.e2e-spec.ts`.
