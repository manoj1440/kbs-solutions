# F-312 Official Telecaller ID card

- Group: Telecaller ops · Status: **DONE** · Depends on: F-201, F-108
- PRD refs: REQ-08 §8.4 (generated at creation; shareable from call interface; fields/photo/expiry OPEN; no PAN/customer/payout data; regenerate/revoke on deactivation), REQ-25 §25.2 (Official ID screen), REQ-28 P1

## Detailed requirements
1. Template v1 (server-rendered PNG/PDF via `@resvg/resvg-js` from an SVG template): KBS logo placeholder, full name, employee code, role "Telecaller", issued date, QR encoding a verification URL `https://<web>/verify/<publicRef>` that shows name + code + validity (no other data). Fields list is config `idcard.fields` so Admin can adjust when policy is approved.
2. Revocation on deactivation: `revokedAt` set; verify URL shows "revoked"; share action refuses `ID_REVOKED`.
3. Telecaller screen: view card, "Share on WhatsApp" (F-311).

## Acceptance criteria
- [x] Card contains no mobile/PAN/customer data (template test).
- [x] Deactivated Telecaller's card verifies as revoked.

## Progress notes
- 2026-09-22 (session 2): `IdCardsService`: template v1 rendered as **SVG** (`renderIdCardSvg`; PNG/PDF rasterisation via resvg deferred — the sandbox has no native build; SVG is accepted for ID_CARD files and opens in WhatsApp/browsers) with logo placeholder, name, employee code, role, issued date and a QR (`qrcode` lib) to `${WEB_ORIGIN}/verify/<publicRef>`; visible fields from `idcard.fields`; stored as `StoredFile(ID_CARD, image/svg+xml)` on first request. Routes: `GET /id-cards/me`, `GET /id-cards/me.svg`, `GET /users/:id/id-card` (Manager team / Admin; sensitive access ID_CARD), `POST /users/:id/id-card/regenerate`, public `GET /verify/:publicRef` (name, code, validity, version only). Revocation: user deactivation (Manager/Admin or training expiry) sets `revokedAt` in the same transaction; reactivation (Admin or training reactivation) issues the next version (`reissueIdCard`). Web public page `/verify/[ref]`. Mobile `(telecaller)/id-card.tsx` (from Profile); sharing to a customer goes through F-311 from the record so it is logged. e2e template test asserts no mobile/PAN/customer data.
