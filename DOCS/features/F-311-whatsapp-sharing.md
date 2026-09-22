# F-311 WhatsApp sharing: benefit PDF, official ID, application link

- Group: Telecaller ops · Status: **DONE** · Depends on: F-109, F-308, F-312, F-403
- PRD refs: REQ-08 §8.5 (three distinct actions; approved current content/links; hand-off ≠ delivery; record initiator/customer/card/asset version/timestamp/outcome; consent policy; integration OPEN), REQ-07 §7.5 (preserve tracking query strings/fragments), REQ-11 §11.6 (Advisor share), REQ-16 §16.3 (link shares metric), REQ-23 §23.3
- QA ids: WA-01, WA-02

## Detailed requirements
1. `POST /share {targetType: CALLING_RECORD|LEAD, targetId, kind: BENEFIT_PDF|OFFICE_ID|APPLICATION_LINK, cardId?}` → resolves the current approved asset (PDF file presigned short link via a KBS redirect `https://<api>/r/<token>`; ID card render; `ApplicationLink.url` **verbatim**), records `ShareAction(handoffResult=OPENED|FAILED, deliveryStatus=UNKNOWN)` and returns the payload for the chosen mode: `HANDOFF` → `wa.me/<E.164>?text=<encoded>`; `BUSINESS_API` → provider send, `providerMessageId`, later webhook sets `SENT/DELIVERED/FAILED`.
2. Consent policy: if `compliance.whatsappConsentPolicy` is null, UI shows a warning but hand-off (user-initiated compose) is allowed; BUSINESS_API mode is disabled until policy set.
3. UI labels: "Share sheet opened" vs "Delivered" strictly by `deliveryStatus` (WA-01).
4. Share of `APPLICATION_LINK` from a calling record also creates a `CallingInterest` (F-310).

## Acceptance criteria
- [x] WA-01: three separate buttons; HANDOFF result never shows "Delivered".
- [x] WA-02: stored `url` equals the catalogue URL byte-for-byte including `utm_*` and `#fragment`; share row links customer + card + link version.

## Progress notes
- 2026-09-22 (session 2): `SharingService.share` (`POST /share`, SHARE_SEND + training/network/onboarding gates, idempotent, audited): target = own CallingRecord or own Lead; suppressed customers refused; `ShareAction` row created first (handoffResult FAILED/deliveryStatus UNKNOWN) then resolved: APPLICATION_LINK → `CatalogueService.effectiveLink` for the actor's channel, URL placed in the message **verbatim**, `assetVersionRef=link:<id>:v<n>`, creates `CallingInterest` (+applicationLinkId) and sets `LINK_SHARED`; BENEFIT_PDF → approved PDF via KBS redirect `/api/v1/r/<token>` (HMAC-signed, 7-day, resolves to a presigned URL, every open audited `share.redirectOpened`); OFFICE_ID → current rendered ID via the same redirect. Provider port decides the channel: HANDOFF returns `wa.me/<E.164>?text=` and `deliveryStatus` stays UNKNOWN; BUSINESS_API is refused until `compliance.whatsappConsentPolicy` is set; `POST /webhooks/whatsapp/delivery` is the only writer of SENT/DELIVERED/FAILED and only for BUSINESS_API rows. `shareStatusLabel()` in shared: "Share sheet opened" vs "Delivered" strictly by status (WA-01). `GET /calling/records/:id/shares`. Mobile `components/share-buttons.tsx` (three buttons on the card detail; opens WhatsApp via `Linking`; consent-policy warning). e2e `sharing.e2e-spec.ts`.
