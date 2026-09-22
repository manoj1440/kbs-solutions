# F-601 Payout rules and rate tables (versioned, per bank)

- Group: Payouts · Status: **PLANNED** · Depends on: F-104, F-403 · ADR-008
- PRD refs: REQ-17 §17.1 (bank-specific trigger evidenced by MIS; raw activation values kept distinct; OPEN/LAUNCH BLOCKER: trigger, amount, reversal, hold), §17.9 (rate change must not rewrite approved/paid snapshots), REQ-14 §14.4 (do not merge V + ACTIVE and TXN ACTIVE - Rs 100), REQ-28 P0 #2–3
- QA ids: PAY-01

## Detailed requirements
1. `PayoutRule {bankId, name, version, triggerField (from snapshot fields; default `cardActivationStatus`), triggerValues[] (exact strings, e.g. ["V + ACTIVE"]), productCodePattern?, holdDays, effectiveFrom/To, approvedByUserId, notes}` — Admin creates as DRAFT, approves with reason (audited); only APPROVED rules within effective dates evaluate.
2. `PayoutRate {ruleId, amountInr, effectiveFrom/To, approvedByUserId}`; the rate in force at `eligibleAt` is snapshotted on the entitlement; later rate edits create new versions and never alter existing entitlement amounts.
3. Seed: **no rules** → nothing is ever eligible (PAY-01). Launch-gate checklist item "Payout rules approved per bank".
4. Admin screens: Rules list per bank, rule editor with trigger picker showing the distinct values actually seen in MIS (from `knownValues`), rate editor, version history.

## Acceptance criteria
- [ ] PAY-01: with no approved rule, `FINAL_DECISION=Approve` + `Card Activation Staus=V + ACTIVE` yields zero entitlements.
- [ ] Rate change after an entitlement exists leaves its `amountInr` unchanged.
