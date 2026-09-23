# ADR-013: MIS preview/apply run as background jobs above a row threshold

- Status: Accepted · Date: 2026-09-23 · Supersedes the "synchronous in-request" note in ADR-005

## Context
F-905 measured ~2 minutes each for preview and apply of a 100k-row MIS batch inside one HTTP request — beyond proxy and browser timeouts and blocking an API worker.

## Decision
Batches above `mis.asyncRowThreshold` (default 2000 rows) run preview/apply as a job (F-508). Production dispatches to the BullMQ `mis-import` queue with the deterministic job id `mis|<kind>|<batchId>`, processed in worker mode; dev/test run the same job function detached in-process (`JOBS_DISPATCH=local`). Job state and progress live on the batch row (not only in Redis) so the UI, audit and recovery don't depend on Redis retention. Small batches stay synchronous so the common case keeps its immediate result.

## Consequences
- The trigger endpoints return either the result (sync) or `{ queued: true, job }` (async); clients handle both.
- Crash safety relies on existing idempotency: row-level `appliedAt` and the `(leadId, batchId, field)` history unique. A stale RUNNING job (no heartbeat for 10 min) can be re-triggered.
- Production must run at least one worker (`WORKER_MODE=1`); `pnpm release:check` and the runbook note this.
