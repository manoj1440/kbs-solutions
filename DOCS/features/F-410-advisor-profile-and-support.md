# F-410 Advisor profile and support

- Group: Advisor · Status: **PLANNED** · Depends on: F-401, F-402
- PRD refs: REQ-11 §11.11, REQ-12 S29, REQ-25 §25.1

## Detailed requirements
Profile screen: name, masked mobile, email, identity verification summary (status/date only), reporting relationship + Agent Code (F-402), bank summary (last4, IFSC), support (config `support.contact`), logout; no cheque/identity files rendered here.

## Acceptance criteria
- [ ] No sensitive file URLs or full numbers in the profile DTO (schema test).
