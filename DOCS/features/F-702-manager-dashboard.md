# F-702 Manager dashboard

- Group: Dashboards & notifications · Status: **IN_PROGRESS** · Depends on: F-313, F-408, F-602, F-604
- PRD refs: REQ-15 §15.2 (filters; counts; Advisor metrics; denominators and sources), §15.3, REQ-16 §16.3 (metric formulas), REQ-20 §20.4
- QA ids: DASH-01, DASH-02

## Detailed requirements
1. `GET /dashboards/manager?from&to&telecallerId&advisorId&bankId&cardId&pincode|state&misRecency` → sections: calling (uploaded/assigned/active/hidden; attempts/connected/no-answer/failed; callbacks due/done; outcomes; shares by kind; recordings available %), advisors (leads created; MIS-matched vs unmatched; stage/decision/activation distributions with 'Not reported'/'Awaiting MIS'; actionable bank reasons; entitlements eligible/requested/approved/paid). Every metric object includes `{value, denominator?, source, dateBasis}`.
2. Web page + mobile summary cards; same service, same numbers.

## Acceptance criteria
- [ ] DASH-01: attempts, shares, leads, decisions, activations are separate metrics with source labels.
- [ ] DASH-02: Manager totals equal Admin totals filtered to that team.
