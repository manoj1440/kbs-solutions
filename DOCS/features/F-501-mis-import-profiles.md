# F-501 MIS import profiles (bank/version) with HDFC v1 seed

- Group: MIS · Status: **DONE** · Depends on: F-104, F-403 · ADR-005
- PRD refs: REQ-13 §13.2 (36 exact HDFC headers as written, incl. misspellings 'Card Activation Staus', 'Decline Descreption'), §13.3 (observed values; not an exhaustive enum), §13.7 (profile contents: format, identifiers, header aliases, distinct stage/decision/activation columns, vocabulary, date/timezone, reason/remarks columns, partial vs full snapshot, matching reference, product code mapping, payout-eligible interpretation; unrecognised column/status must not crash or be converted), §13.8, REQ-28 P0 (semantics per bank)
- QA ids: MIS-01, MIS-11

## Detailed requirements
1. `MisImportProfile` fields per data model. `fieldMap` maps internal snapshot fields to **exact raw headers**; `headerAliases` allow tolerant matching (trim, case-insensitive, collapsed spaces) but the raw header is always stored as seen.
2. HDFC v1 seed: all 36 columns mapped (`applicationNo`→`Application No`, `lc2Code`, `currentStage`→`CURRENT_STAGE`, `applicationReferenceNumber`, `creationDateTime`, `customerType`, `customerName`, `channel`, `ipaStatus`, `dapFinalFlag`, `dropoffReason`, `idcomStatus`, `vkycStatus`, `vkycConsentDate`, `vkycExpiryDate`, `captureLink`, `promoCode`, `productCode`, `finalDecision`, `finalDecisionDate`, `declineCode`, `declineDescription`, `curableFlag`, `companyName`, `bkycStatus`→`BKYC Status`, `reason`→`Reason`, `kycStatus`→`KYC Status`, `decisionMonth`, `declineDescription2`→`Decline Descreption`, `declineType`, `productDescription`→`Product Des`, `securedUnsecured`, `kycSuccessNr`→`KYC Success/NR`, `cardType`, `creationDate`→`Creation Date`, `cardActivationStatus`→`Card Activation Staus`); `referenceFields=[{kind:APPLICATION_NO, header:'Application No'},{kind:APPLICATION_REFERENCE_NUMBER, header:'APPLICATION_REFERENCE_NUMBER'}]`; `snapshotMode=DELTA`, `blankOverwrites=false`, `timezone=Asia/Kolkata (assumed)`, `knownValues` seeded from §13.3; status `DRAFT` until Admin approves.
3. Unknown headers in a file are kept in `raw` and listed as "unmapped columns" in preview; unknown values are stored verbatim and listed as "new values pending mapping" — never translated (MIS-11).
4. Admin screen: profile editor (header list from a sample file, drag/assign to internal fields, reference order, snapshot mode, timezone, known-values list), approve with reason, version history.

## Acceptance criteria
- [x] HDFC sample-like fixture maps all 36 headers; a file with an extra column still imports with the column in `raw`.
- [x] A new `CURRENT_STAGE` value not in `knownValues` is stored verbatim and flagged, not rejected.

## Progress notes
- 2026-09-22 (session 3): `MisProfileService` — `GET /mis/profiles[?bankId]`, `GET /mis/profiles/:id` (adds `internalFields` text/date lists), `PATCH` (validates internal field names and ≥1 reference field; DRAFT edited in place, APPROVED → new DRAFT version), `POST /mis/profiles/:id/approve {reason}` (retires the previous APPROVED version), `POST /mis/profiles/:id/known-values` (Admin acknowledges observed values — never translates them). Header resolution (`resolveHeaders`): exact → alias → normalised (trim/case/spaces); raw headers are stored as seen; unmapped columns listed. HDFC v1 seed maps all 36 headers with the PRD misspellings. Admin web `/admin/mis` + `/admin/mis/profiles/[id]` editor (mapping, references, aliases, snapshot mode, timezone, blank policy, date formats, approve, known values). e2e `mis-import.e2e-spec.ts`. Prisma seed shape unchanged.
