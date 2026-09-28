# F-810 — Compact leads browser (Admin + Manager)

**Status:** DONE

`/admin/leads` and `/manager/leads` share `LeadsBrowser`. It was rebuilt to the F-808/809 pattern: cumulative MiniStat tiles (`GET /leads/summary`, scope-aware), one filter row (search · bank · card · sort · Apply/Reset) with a collapsed "More filters" disclosure (dates, stage/decision/activation, freshness, actionable), the REQ-14 §14.2 status table scrolling inside the panel, footer pagination. PageHeader/StatCards/active-filter chips/hint copy removed; no page scroll on desktop.

## API
- `GET /leads/summary` — `LEAD_READ_OWN|TEAM|ALL`; returns `{ total, matched, awaitingMis, approved, declined, inProcess, decisionBlank, cardsActive, cardsInactive, activationBlank }` over the actor's scope. Bank-verbatim classification (approve/declin|reject/activ|inactiv) matching F-809's buckets.

## Verified
- Browser: tiles + filters + expandable table at 1440 & 390, no page scroll (desktop) / no x-overflow (phone).
- api e2e `leads-list`: +1 test asserting summary buckets for admin, advisor-1 (3 leads), advisor-2 (1 lead) scopes — 5/5 pass.
