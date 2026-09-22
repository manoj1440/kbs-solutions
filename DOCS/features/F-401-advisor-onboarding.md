# F-401 Advisor self-registration and verified onboarding

- Group: Advisor · Status: **DONE** · Depends on: F-101, F-108, F-109, F-111
- PRD refs: REQ-10 §10.1 (steps: mobile → OTP → name/email → consent/instructions → Aadhaar via authorised method → bank details → cancelled cheque → optional Agent Code → review/submit → available when review complete; only name/mobile/email mandatory profile fields; record consent; privacy notice), §10.2 (Aadhaar safeguards; never store number/XML/share code), §10.3 (bank details, cheque; mask; log privileged access; Advisor PAN OPEN), REQ-12 S01–S07, REQ-21 §21.4, REQ-28 P0 (verification mode)
- QA ids: FOS-01

## Detailed requirements
1. Signup begins with `purpose=ADVISOR_SIGNUP` OTP (F-101) → user `ADVISOR/PENDING_ONBOARDING` + `AdvisorProfile(onboardingStep=PERSONAL)`.
2. Steps (each `PATCH /onboarding/me/<step>` idempotent, resumable, order enforced server-side): `PERSONAL {fullName, email}` → `CONSENT {privacyNoticeVersion, identityConsent: true, at}` stored in `consentRecords[]` → `IDENTITY` (`KycProvider.start` → instructions → `complete` with provider payload; store `status, provider, providerRef, verifiedAt, method`; **no Aadhaar number, XML, share code or image is ever accepted by the API schema**) → `BANK {accountHolderName, accountNumber (encrypted, last4 kept), ifsc (regex), bankName}` → `CHEQUE` (file purpose CHEQUE, image/pdf) → `AGENT_CODE` (optional; F-106) → `REVIEW` → `SUBMIT` (`submittedAt`).
3. Availability policy: `onboarding.requiresAdminReview` (default **true**): Admin reviews (`APPROVE | REJECT reason`) → user `ACTIVE`; until then `gates.onboarding.complete=false, step=AWAITING_REVIEW`. If false, `SUBMIT` activates immediately when identity `VERIFIED`.
4. Identity verification failure → step stays `IDENTITY` with retry; provider `UNAVAILABLE` → clear message, no fake success.
5. Advisor PAN collection is **not** built (OPEN); a config flag `onboarding.collectAdvisorPan=false` reserves the step.
6. Masking: profile DTO shows account last4, IFSC, holder; full account only via `?reveal=bank` for Accounts/Admin with log.
7. Mobile screens: S01–S05 marketing/onboarding carousel (no approval promises copy), S06 mobile, S07 OTP, then step screens with progress indicator, review summary, "awaiting review" state.
8. Admin web: onboarding review queue with identity summary (provider result only), masked bank, cheque viewer (audited), approve/reject.

## Acceptance criteria
- [x] FOS-01: full path with mock KYC → submitted → Admin approves → Advisor home accessible.
- [x] Schema test: any field named like `aadhaar*` other than `aadhaarVerificationStatus` rejected; DB has no such column.
- [x] Resuming after app kill lands on the correct step.

## Progress notes
- 2026-09-22 (session 3): `OnboardingService` — server-ordered, resumable steps: `GET /onboarding/me` (view with step index/total), `PUT /onboarding/me/{personal,consent,bank,cheque,agent-code}`, `POST /onboarding/me/identity/{start,complete}`, `POST /onboarding/me/submit`. All bodies are `.strict()` Zod schemas; identity `payload` refuses keys matching `aadhaar|uid|share code|xml` and 12-digit strings; provider evidence summary is scrubbed of such keys before storage; e2e asserts no `aadha*` column in schema.prisma or the live DB. Consent stores `{privacyNoticeVersion (must equal config onboarding.privacyNoticeVersion), identityConsent, termsAccepted, at, ip}` records. Bank account AES-encrypted + last4; IFSC regex; cheque must be a CHEQUE-purpose file uploaded by the Advisor. Steps lock after submission (AWAITING_REVIEW/COMPLETE → 409); reject returns the Advisor to REVIEW with the reason and keeps verified steps. `onboarding.requiresAdminReview` true → Admin `GET /onboarding/review[/ :userId?reveal=bank]` (reveal needs SENSITIVE_REVEAL_BANK, logs BANK_ACCOUNT access) + `POST /onboarding/review/:userId {APPROVE|REJECT reason}`; approve activates the user (lifecycle ACTIVATED, notification ONBOARDING_APPROVED); false → submit activates when identity VERIFIED. Web `/admin/onboarding[/userId]`. Mobile `(gates)/onboarding.tsx` wizard (progress bar, step screens, KYC start/complete via provider instructions, cheque via image picker, Agent Code with live validation, review/edit, awaiting-review state). Advisor PAN not collected (OPEN, flag reserved).
