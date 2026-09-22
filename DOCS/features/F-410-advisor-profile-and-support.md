# F-410 Advisor profile and support

- Group: Advisor · Status: **DONE** · Depends on: F-401, F-402
- PRD refs: REQ-11 §11.11, REQ-12 S29, REQ-25 §25.1

## Detailed requirements
Profile screen: name, masked mobile, email, identity verification summary (status/date only), reporting relationship + Agent Code (F-402), bank summary (last4, IFSC), support (config `support.contact`), logout; no cheque/identity files rendered here.

## Acceptance criteria
- [x] No sensitive file URLs or full numbers in the profile DTO (schema test).

## Progress notes
- `GET /me/profile` (ONBOARDING_SELF) → `AdvisorProfileView` (strict zod, `packages/shared/src/schemas/onboarding.ts`): name, masked mobile, email, identity {status, verifiedAt, method}, reporting {parent, agentCode, since, pendingChange}, bank {bankName, accountLast4, ifsc}, onboarding {step, submittedAt, reviewOutcome}, support {contact from `support.contact`}, idCard {publicRef}. The service parses its own output through the strict schema, so an added field fails loudly.
- Schema test `packages/shared/test/advisor-profile.test.ts` rejects file ids, URLs, full account numbers and identity payloads; onboarding e2e asserts the live DTO has exactly those keys and no cheque/file/URL/account number.
- Mobile Profile screen rebuilt on the DTO (identity summary, reporting + Agent Code change (F-402), bank last4/IFSC, ID card ref, support contact as mailto/tel, sign out).
