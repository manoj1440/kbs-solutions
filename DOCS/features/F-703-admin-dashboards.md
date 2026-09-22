# F-703 Admin dashboards (executive, telecaller, manager, advisor, bank/card mix, payouts)

- Group: Dashboards & notifications · Status: **PLANNED** · Depends on: F-702, F-507, F-606
- PRD refs: REQ-16 §16.2 (eight dashboards), §16.3 (formulas & guardrails; label date basis; never imply live bank status), REQ-01 §1.3, REQ-20 §20.4 (never hide conflicts behind green KPI)
- QA ids: DASH-01, DASH-02

## Detailed requirements
1. Read-model SQL views (migration) for: call metrics, share metrics, lead counts, MIS distributions, entitlement states — each with population keys (period, manager, telecaller, advisor, bank, card).
2. Endpoints per dashboard with filters; `meta.dateBasis` and `meta.misFreshness` (per-bank last applied batch) in responses.
3. Web pages: Executive overview (tiles + per-bank freshness strip + launch-gate checklist), Telecaller performance, Manager performance, Advisor performance, Bank/card mix, Payout liability (F-606), MIS integrity (F-507), Audit (F-704).
4. Any conflict/unmatched count > 0 shows an amber banner on the executive page (never hidden).

## Acceptance criteria
- [ ] Fixture-based equality between dashboard figures and raw table counts.
