# F-402 Agent Code in signup and profile (Advisor-facing)

- Group: Advisor · Status: **PLANNED** · Depends on: F-106, F-401
- PRD refs: REQ-10 §10.4, REQ-11 §11.11 (submit code later under auditable effective-date policy), REQ-12 S29
- QA ids: FOS-02

## Detailed requirements
1. Signup step shows optional code input with live validation (`GET /agent-codes/validate?code=` → valid/invalid without exposing owner name until applied; after apply shows "Reporting to: <Manager name>").
2. Profile: current reporting person, "Change code" → applies F-106 rules (pending Admin approval when leads exist), shows effective date and pending state.
3. Copy makes clear that historical leads/payouts keep their original attribution.

## Acceptance criteria
- [ ] FOS-02 UI path (blank → Admin; valid → Manager; invalid → message, unchanged).
