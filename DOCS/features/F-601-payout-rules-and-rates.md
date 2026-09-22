# F-601 Payout rules and rate tables (versioned, per bank)

- Group: Payouts · Status: **DONE** · Depends on: F-104, F-403 · ADR-008
- PRD refs: REQ-17 §17.1 (bank-specific trigger evidenced by MIS; raw activation values kept distinct; OPEN/LAUNCH BLOCKER: trigger, amount, reversal, hold), §17.9 (rate change must not rewrite approved/paid snapshots), REQ-14 §14.4 (do not merge V + ACTIVE and TXN ACTIVE - Rs 100), REQ-28 P0 #2–3
- QA ids: PAY-01

## Detailed requirements
1. `PayoutRule {bankId, name, version, triggerField (from snapshot fields; default `cardActivationStatus`), triggerValues[] (exact strings, e.g. ["V + ACTIVE"]), productCodePattern?, holdDays, effectiveFrom/To, approvedByUserId, notes}` — Admin creates as DRAFT, approves with reason (audited); only APPROVED rules within effective dates evaluate.
2. `PayoutRate {ruleId, amountInr, effectiveFrom/To, approvedByUserId}`; the rate in force at `eligibleAt` is snapshotted on the entitlement; later rate edits create new versions and never alter existing entitlement amounts.
3. Seed: **no rules** → nothing is ever eligible (PAY-01). Launch-gate checklist item "Payout rules approved per bank".
4. Admin screens: Rules list per bank, rule editor with trigger picker showing the distinct values actually seen in MIS (from `knownValues`), rate editor, version history.

## Acceptance criteria
- [ ] PAY-01 (asserted in F-602): with no approved rule, `FINAL_DECISION=Approve` + `Card Activation Staus=V + ACTIVE` yields zero entitlements.
- [x] Rate change after an entitlement exists leaves its `amountInr` unchanged.

## Progress notes
- Shared `schemas/payouts.ts`: `CreatePayoutRuleBody` (triggerField restricted to non-PII snapshot fields, default `cardActivationStatus`; exact `triggerValues` trimmed only; optional `productCodePattern` regex; `holdDays`; effective window), `UpdatePayoutRuleBody`, `CreatePayoutRateBody`, `PayoutRuleView`.
- API `payouts` module: `GET/POST /payouts/rules`, `GET /payouts/rules/seen-values?bankId&field` (trigger picker: approved profile `knownValues` ∪ snapshot values), `GET /payouts/rules/:id`, `PATCH` (DRAFT in place; APPROVED → new DRAFT version carrying approved rates), `POST …/approve|retire` (reason, audited; approving vN retires older APPROVED versions of the same name), `POST /payouts/rules/:id/rates`, `POST /payouts/rates/:id/approve` (closes/retires overlapping approved rates at the new effectiveFrom). `PayoutRulesService.rateAt(rates, at)` is the single pricing lookup used by F-602. Seed has no rules.
- Web `/admin/payouts/rules` (bank readiness badges, new-rule form with seen-values picker) and `/admin/payouts/rules/[id]` (actions, rates, version history). Browser-checked (`scratchpad/payout-rule.png`).
- Tests: `apps/api/test/payout-rules.e2e-spec.ts` (lifecycle, validation, versioning, rate closing, audit rows). PAY-01 (no rule → no entitlement) lands with F-602 evaluation.
