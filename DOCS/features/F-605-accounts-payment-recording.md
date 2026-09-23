# F-605 Accounts queue, external payment record, proof and paid state

- Group: Payouts · Status: **IN_PROGRESS** · Depends on: F-604, F-108
- PRD refs: REQ-17 §17.6 (ready row content; manual transfer outside KBS; record date/amount/reference/method + proof; no in-app disbursement), §17.7 (Paid; entitlements 'Paid for this event'; counts; traceability; reject duplicate references; exceptions for partial/reversal/correction), REQ-18 §18.1–18.3, REQ-25 §25.5, REQ-26 §26.3 steps 4–5
- QA ids: PAY-05, PAY-06, PAY-07

## Detailed requirements
1. Accounts web: queues `Awaiting payment` (state APPROVED), `Paid`, `Exceptions`. Request detail: Advisor name, masked payee bank (reveal with log), request/approval ids, both approval records, itemised cards, approved amount.
2. `POST /payouts/requests/:id/payment {paidAt, amountInr, transferReference, method?, proofFileId?}` (Accounts, `PAYMENT_RECORD`, idempotent): `transferReference` unique across all payments → duplicate → `PAYOUT_DUPLICATE_TRANSFER_REFERENCE`; amount ≠ approved → `ExternalPayment(state=EXCEPTION)`, request `ON_HOLD`, Admin notified; else if proof present (or not required) → request `PAID`, entitlements `PAID` + events; if proof missing and required → `PAYMENT_RECORDED_PENDING_PROOF` with follow-up `POST …/payment/proof`.
3. No endpoint moves money; no "disburse" button exists (grep test).
4. Corrections: `POST …/payment/correct {reason, …}` creates a new `ExternalPayment` with `correctionOfId`; prior entry retained; Admin approval required.
5. Advisor sees paid confirmation + receipt summary (date, amount, masked reference); Manager/Admin see full trace.

## Acceptance criteria
- [ ] PAY-05: payment recorded with proof → PAID; DB has no funds-transfer integration.
- [ ] PAY-06: paid entitlement excluded from available; MIS snapshot unchanged; trace request→approvals→payment.
- [ ] PAY-07: wrong amount → exception + ON_HOLD; duplicate reference refused; missing proof → pending proof queue.
