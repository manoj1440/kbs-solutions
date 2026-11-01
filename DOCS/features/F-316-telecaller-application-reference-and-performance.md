# F-316 Telecaller application reference → MIS status, and the Telecaller's own performance

- Group: Telecaller ops · Status: **DONE** · Depends on: F-310, F-311, F-505, F-903, F-313
- PRD refs: REQ-08 §8.7 ("operational calling lead/interest … usable for … later MIS matching where KBS receives a reliable reference"; no Telecaller payout), REQ-13 §13.5 (exact reference only), REQ-11 §11.6 (reference captured by a supported mechanism), REQ-15 §15.3 (evidence counts, no ranking), INV-01/02/03/05/08
- Origin: session 21 end-to-end test — MIS rows for customers a Telecaller sent a card link to stayed UNMATCHED (a `CallingInterest` had no bank reference), and Telecallers had no view of their own numbers. User decision "fix both"; design in gap-analysis A21.

## Detailed requirements
1. After the customer applies, the Telecaller types the bank application number on the interest: `POST /calling/interests/:id/bank-reference {referenceKind, referenceValue}` (own interest; Admin any). Trim ends only; unique per bank + kind + value across **both** calling interests and Advisor lead linkages (409, no details). MIS-verified references are locked for the Telecaller.
2. MIS matching (`MisPipelineService.match`): a row with no lead match is matched against interest references with the same exact (bank, kind, value) rule → `MisRow.matchedCallingInterestId`. Never name / mobile (INV-08).
3. MIS apply writes `CallingBankStatus` (application no., current stage, final decision, card activation, decision date — verbatim) inside the MIS apply transaction; the F-903 trigger guards the table (INV-01). Blank never overwrites (INV-02); the three status fields stay separate (INV-03); no payout evaluation (INV-05). The interest's reference becomes verified and the Telecaller gets a `MIS_CHANGED` notification.
4. `GET /calling/interests` (own / team / all) — each interest with reference, stage (`AWAITING_REFERENCE | AWAITING_BANK_UPDATE | IN_PROCESS | APPROVED | DECLINED`), and `bankStatus` with `provenance: BANK_MIS` + `asOf`.
5. `GET /calling/me/performance` (Telecaller): today + last 30 days (calls, connected, talk time, interests, shares — the F-313 engine scoped to self), queue size, follow-ups due, and all-time application stage counts. `/calling/team/overview` rows gain the same `applications` counts.
6. Mobile Telecaller: record screen "Applications" section with an `InterestCard` per interest (status badge, MIS values, reference entry/correction); new tab **My stats** (`(telecaller)/performance`, FLAG_SECURE). Web Caller performance gets a "Bank approved" column (declined · need app no.).

## Acceptance criteria
- [x] MIS row carrying only the customer's name/mobile stays unmatched; with the typed application number it updates the interest.
- [x] Duplicate reference refused; another Telecaller → 404; verified reference locked.
- [x] Bank values stored verbatim; blank later never wipes; raw UPDATE outside MIS apply refused (INV-01); no `BankStatusSnapshot` / `PayoutEntitlement` rows.
- [x] Telecaller performance and Admin overview carry approved / declined / need-app-no. counts.

## Progress notes
- 2026-11-01 (session 21): built as above. Migration `20261101120000_calling_interest_bank_status` (interest reference columns + unique, `CallingBankStatus` + F-903 trigger, `MisRow.matchedCallingInterestId`); `CallingBankStatus` added to the Prisma-level protected models. e2e `calling-interest-mis.e2e-spec.ts` (5 tests). Flow script on fresh data 17/17 (10 references → MIS → 5 approved / 5 declined across 5 Telecallers). Screens checked on Expo web 390 px (My stats, record Applications form) and web Caller performance.
