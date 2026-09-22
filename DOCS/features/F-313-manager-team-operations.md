# F-313 Manager team operations views

- Group: Telecaller ops · Status: **PLANNED** · Depends on: F-205, F-305, F-309, F-310, F-311
- PRD refs: REQ-15 §15.1 (allocations, follow-ups, declines, materials shared, attempts, recordings), §15.3 (drill-down; no automatic decisions/hidden ranking), REQ-25 §25.3
- QA ids: RBAC-01, CALL-02

## Detailed requirements
1. Team overview (web + mobile): Telecallers with status/training/WFH/active queue size/today's attempts & connected.
2. Telecaller detail: allocation history, calls (attempts, provider state, duration, recording chip → play if AVAILABLE), outcomes, follow-ups due, shares, remarks; date filters.
3. Customer operational history view (own team) including hidden records.
4. No score/ranking widgets; only evidence tables with denominators.

## Acceptance criteria
- [ ] Manager sees only own team's data across all tabs; recording playback audited.
