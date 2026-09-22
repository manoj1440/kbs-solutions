# F-305 Automatic allocation of accepted records to trained Telecallers

- Group: Telecaller ops · Status: **IN_PROGRESS** · Depends on: F-303, F-203, F-104
- PRD refs: REQ-06 §6.4 (distribute among active, training-completed Telecallers under all Managers; allocation history with batch/user/time/reason; Admin org totals, Manager team, Telecaller own; algorithm OPEN → configurable; none eligible → visibly unassigned), REQ-15 §15.1 (no cross-team reassignment without authorised log), REQ-19 §19.1 (new assignment notification)
- QA ids: CUST-02

## Detailed requirements
1. Eligible pool = users `role=TELECALLER, status=ACTIVE` with `TrainingEnrollment.status ∈ {PASSED}` and (if set) active count `< allocation.maxActivePerTelecaller`.
2. Algorithms (config `allocation.algorithm`): `ROUND_ROBIN_EQUAL` (default; deterministic order by current active-load ascending then employee code), `WEIGHTED_BY_CAPACITY` (weights from `maxActivePerTelecaller` headroom), `REGION_PREFERRED` (match Telecaller's optional `preferredStates[]` then fall back). Version string stored on each `AllocationEvent.algorithmVersion`.
3. If pool empty → records stay `assignedTelecallerUserId=null` and the batch shows an "unassigned: no eligible Telecaller" count; Admin can trigger `POST /allocation/run` later.
4. Manual reassignment: Manager within own team; Admin across teams; reason mandatory; event recorded; the record's history and outcomes remain.
5. Bulk reassignment on Telecaller deactivation is **not automatic** (reassignment authority OPEN) — Manager sees "N records assigned to inactive Telecaller" prompt.
6. Views: Admin totals (assigned/unassigned/hidden/suppressed by batch), Manager team distribution, Telecaller count in queue.

## Acceptance criteria
- [x] 10 accepted records, 3 eligible Telecallers → 4/3/3 in deterministic order; events recorded with batch and reason `AUTO_ALLOCATION`.
- [x] Untrained Telecaller receives nothing.
- [x] Notification "New customers assigned (N)" sent once per batch per Telecaller.

## Progress notes
- 2026-09-22 (session 2): `AllocationService` (API core): eligible pool = ACTIVE Telecallers with `TrainingEnrollment.status=PASSED` under `allocation.maxActivePerTelecaller` headroom; algorithms `ROUND_ROBIN_EQUAL` (least-loaded first, ties by employeeCode → name), `WEIGHTED_BY_CAPACITY` (filled fraction of cap), `REGION_PREFERRED` (config `allocation.regionPreferences` {employeeCode: states[]}, falls back to round robin); `AllocationEvent` per record (`reason=AUTO_ALLOCATION`, `algorithmVersion=<algo>:v1`), `batch.allocatedAt`, one `ASSIGNMENT_NEW` notification per Telecaller per run; compliance gate (global config OR per-batch attestation) enforced in `allocateBatchIfAllowed` (silent) and `run` (409). `batchTotals` for Admin. Pending: manual reassignment endpoints (Manager team / Admin any, reason mandatory), Manager team distribution + Telecaller queue count views, deactivation prompt.
