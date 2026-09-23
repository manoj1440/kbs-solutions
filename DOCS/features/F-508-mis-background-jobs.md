# F-508 MIS preview/apply as background jobs with progress

- Group: MIS · Status: **IN_PROGRESS** · Depends on: F-503, F-505, F-110, F-905
- PRD refs: REQ-13 §13.4 (batch processing), REQ-24 §24.1 (retry without duplicates), REQ-24 §24.2 (performance), ADR-004, ADR-005, ADR-013
- Origin: F-905 perf baseline — a 100k-row batch took ~1m50s to preview and ~1m47s to apply inside one HTTP request (`DOCS/perf/01-baseline-results.md`). User chose to move it to a background job (session 8).

## Detailed requirements
1. Batches with more than `mis.asyncRowThreshold` rows (default 2000) run preview and apply as a background job; smaller batches keep the synchronous response (same result shape as before).
2. Dispatch: `JOBS_DISPATCH=queue` enqueues on the BullMQ `mis-import` queue (processed by worker mode); `local` runs the job detached in the API process (dev/test). Default: `queue` in production, `local` otherwise.
3. One job per batch at a time: triggering again while QUEUED/RUNNING returns the current job (no duplicate work); a RUNNING job whose heartbeat is older than 10 minutes counts as stale and may be re-triggered. Apply stays resumable through row-level `appliedAt` (MIS-08: re-processing writes no new history).
4. Stage validation happens before queueing (an invalid stage is refused immediately).
5. Progress: batch carries `jobKind`, `jobStatus` (QUEUED/RUNNING/SUCCEEDED/FAILED), `jobProgress {phase, done, total}`, `jobError`, requested-by, queued/started/heartbeat/finished times. `GET /mis/batches/:id/job` returns it.
6. Completion is audited (`misBatch.previewCompleted` / `misBatch.applyCompleted` with totals) and the requester gets the existing MIS_IMPORT_RESULT notification; failures are audited (`misBatch.jobFailed`), set `jobStatus=FAILED` (apply also sets stage FAILED so it can be retried) and notify the requester.
7. Web batch page: shows progress and polls while a job is queued/running; buttons disabled meanwhile.

## Acceptance criteria
- [ ] A batch above the threshold returns immediately with a queued job; polling shows RUNNING → SUCCEEDED; resulting stage, history and totals equal the synchronous path.
- [ ] Triggering again while a job is active does not start a second job.
- [ ] A failed background job is visible (status, error, audit, notification) and can be retried; retry does not duplicate history.
- [ ] Small batches still complete synchronously.

## Progress notes
