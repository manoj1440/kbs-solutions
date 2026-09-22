# F-313 Manager team operations views

- Group: Telecaller ops · Status: **DONE** · Depends on: F-205, F-305, F-309, F-310, F-311
- PRD refs: REQ-15 §15.1 (allocations, follow-ups, declines, materials shared, attempts, recordings), §15.3 (drill-down; no automatic decisions/hidden ranking), REQ-25 §25.3
- QA ids: RBAC-01, CALL-02

## Detailed requirements
1. Team overview (web + mobile): Telecallers with status/training/WFH/active queue size/today's attempts & connected.
2. Telecaller detail: allocation history, calls (attempts, provider state, duration, recording chip → play if AVAILABLE), outcomes, follow-ups due, shares, remarks; date filters.
3. Customer operational history view (own team) including hidden records.
4. No score/ranking widgets; only evidence tables with denominators.

## Acceptance criteria
- [x] Manager sees only own team's data across all tabs; recording playback audited.

## Progress notes
- 2026-09-22 (session 2): `TeamOpsService`: `GET /calling/team/overview?from&to` (default last 7 days; per Telecaller: status, training, WFH active, queue size, follow-ups due now, attempts, provider-confirmed connected + talk time, outcomes by kind, shares by kind, interests) and `GET /calling/team/telecallers/:id/activity?from&to` (attempts with recording chip/canPlay, outcomes, shares with hand-off vs delivery label, remarks, allocation events in/out, open follow-ups with overdue flag). Manager → own team only (other team → 404), Admin → all, Telecaller → 403. No scores or rankings — evidence tables with denominators only. Web: `TeamOverview` + `TelecallerActivity` components on `/manager/calling[/telecaller/:id]` and `/admin/calling-list/distribution[/telecaller/:id]`, date-range form, `PlayRecordingButton` (fetches the audited playback URL). Mobile Manager telecaller screen shows a 7-day calling summary. e2e in `calls.e2e-spec.ts` (F-313 case).
