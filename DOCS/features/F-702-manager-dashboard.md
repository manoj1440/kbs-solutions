# F-702 Manager dashboard

- Group: Dashboards & notifications · Status: **DONE** · Depends on: F-313, F-408, F-602, F-604
- PRD refs: REQ-15 §15.2 (filters; counts; Advisor metrics; denominators and sources), §15.3, REQ-16 §16.3 (metric formulas), REQ-20 §20.4
- QA ids: DASH-01, DASH-02

## Detailed requirements
1. `GET /dashboards/manager?from&to&telecallerId&advisorId&bankId&cardId&pincode|state&misRecency` → sections: calling (uploaded/assigned/active/hidden; attempts/connected/no-answer/failed; callbacks due/done; outcomes; shares by kind; recordings available %), advisors (leads created; MIS-matched vs unmatched; stage/decision/activation distributions with 'Not reported'/'Awaiting MIS'; actionable bank reasons; entitlements eligible/requested/approved/paid). Every metric object includes `{value, denominator?, source, dateBasis}`.
2. Web page + mobile summary cards; same service, same numbers.

## Acceptance criteria
- [x] DASH-01: attempts, shares, leads, decisions, activations are separate metrics with source labels.
- [x] DASH-02: Manager totals equal Admin totals filtered to that team.

## Progress notes
- Metric engine `apps/api/src/modules/dashboards/dashboard-metrics.service.ts` (shared with F-703): `scope(actor, q)` resolves Telecaller/Advisor populations (Manager → own direct team; Admin → everyone or `managerId`; out-of-scope ids → 404), `compute(scope, q)` returns `calling` + `advisors` sections and `meta` (range, date bases, per-bank MIS freshness, "never live bank status" note).
- Every metric is `{value, amountInr?, denominator?, source, dateBasis}` with sources `KBS_CALLING`, `TELEPHONY_PROVIDER`, `KBS_SHARING`, `KBS_LEADS`, `BANK_MIS`, `KBS_PAYOUT_LEDGER`, `ACCOUNTS_PAYMENT` (REQ-16 §16.3): attempts = provider-confirmed (`providerCallId` set) and reported separately from failed-before-provider; connected only from provider `connectedAt`; unique customers contacted = distinct connected records; shares = recorded actions, delivered only when a delivery status exists; stage/decision/activation distributions quote raw MIS values with `Not reported` (matched, blank/#N/A) and `Awaiting MIS` (never matched); bank reasons = first non-blank remark/decline field; payouts reuse the F-606 bucket classifier.
- Filters: `from,to` (IST days; each section states its own date basis), `managerId, telecallerId, advisorId, bankId, cardId, pincode, state` (case-insensitive), `misRecency=within7|within30|older30|never`.
- `GET /dashboards/manager` (DASHBOARD_MANAGER: Manager and Admin). Web `/manager/dashboard` (`OperationsDashboard` component) and mobile Manager home summary cards read the same endpoint. Browser-checked at 1280 and 390 px (no overflow).
- Tests `apps/api/test/dashboards.e2e-spec.ts`: DASH-01 figures + sources + raw-table equality; DASH-02 Manager == Admin `?managerId=`, team sums == organisation, filter/scope 404s, MIS recency and state filters.
- Decision: computed on read with indexed counts (no materialised SQL views yet); revisit with the F-905 performance harness if thresholds require it.
