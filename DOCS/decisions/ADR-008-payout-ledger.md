# ADR-008: Payout ledger, reservation and dual approval mechanics

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-17, REQ-18, INV-05/06

## Decision
- `PayoutEntitlement` is created **only** by `payouts/eligibility.service.ts` when an APPLIED MIS batch yields a row whose `triggerField` value is in an active `PayoutRule.triggerValues` for that bank, after `holdDays`. `eventKey` is unique so re-imports never create a second entitlement for the same bank event.
- No active `PayoutRule` exists in seed → no entitlement can be created → the system fails closed until KBS supplies rules (REQ-28 §28.2).
- Reservation: `POST /payouts/requests` runs one transaction: `SELECT … FOR UPDATE` the chosen entitlements, assert all `ELIGIBLE_AVAILABLE`, insert request + items, set entitlements `RESERVED`, append events. Partial unique index on `PayoutRequestItem.entitlementId WHERE active` is the last line of defence. `Idempotency-Key` required.
- Dual approval: two `PayoutApproval` rows (`MANAGER`, `ADMIN`), each by a different user; Admin approving does not create the Manager row. Advisor-under-Admin: `managerApproverUserId` resolved from `SystemConfig.payouts.designatedApproverManagerUserId`; request creation refuses if unset.
- `ExternalPayment` with unique `transferReference`; `PAID` only with proof file when `payouts.proofRequiredForPaid` (default true). Amount mismatch → `EXCEPTION`, request `ON_HOLD`.
- Rejection releases items → `ELIGIBLE_AVAILABLE`. Cancel authority: Advisor before any approval; Admin any time before `PAID`; both audited.
