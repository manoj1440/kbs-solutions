# F-312 Official Telecaller ID card

- Group: Telecaller ops · Status: **PLANNED** · Depends on: F-201, F-108
- PRD refs: REQ-08 §8.4 (generated at creation; shareable from call interface; fields/photo/expiry OPEN; no PAN/customer/payout data; regenerate/revoke on deactivation), REQ-25 §25.2 (Official ID screen), REQ-28 P1

## Detailed requirements
1. Template v1 (server-rendered PNG/PDF via `@resvg/resvg-js` from an SVG template): KBS logo placeholder, full name, employee code, role "Telecaller", issued date, QR encoding a verification URL `https://<web>/verify/<publicRef>` that shows name + code + validity (no other data). Fields list is config `idcard.fields` so Admin can adjust when policy is approved.
2. Revocation on deactivation: `revokedAt` set; verify URL shows "revoked"; share action refuses `ID_REVOKED`.
3. Telecaller screen: view card, "Share on WhatsApp" (F-311).

## Acceptance criteria
- [ ] Card contains no mobile/PAN/customer data (template test).
- [ ] Deactivated Telecaller's card verifies as revoked.
