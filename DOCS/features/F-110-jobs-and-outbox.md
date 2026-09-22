# F-110 Background jobs (BullMQ), worker mode and outbox

- Group: Core · Status: **IN_PROGRESS** · Depends on: F-002, F-003 · ADR-004
- PRD refs: REQ-05 §5.4 (automatic deactivation at deadline), REQ-13 §13.4 (batch processing), REQ-19 (notifications), REQ-24 §24.1 (retry without duplicates)

## Detailed requirements
1. `JobsModule` registers queues `training`, `mis-import`, `notifications`, `files`, `payouts`, `maintenance` with BullMQ; `WORKER_MODE=1` starts processors only; default mode starts HTTP only (+ optional inline processors in dev via `JOBS_INLINE=1`).
2. `OutboxEvent` table; services append domain events in the same transaction as the business write; a relay job (every 5 s + on-demand trigger) moves them to queues; processed events marked, with attempts and dead-letter after 5.
3. Job ids are deterministic per entity (`training:expire:<enrollmentId>`, `mis:apply:<batchId>`) so duplicates collapse.
4. Repeatable job `training.sweep` every 5 min finds enrollments with `deadlineAt < now` and status `IN_PROGRESS` → F-204 handler; `payouts.staleSweep` daily.
5. Observability: BullMQ metrics in `/health` (queue depths), job failures logged with requestId from payload.

## Acceptance criteria
- [ ] Outbox events created in a rolled-back transaction are not relayed.
- [ ] Re-adding a job with the same id is a no-op.
- [ ] Worker mode boots without listening on HTTP.

## Progress notes
- 2026-09-22 (session 1): JobsService (BullMQ queues), OutboxService relay with deterministic job ids, worker mode boot. Pending: repeatable sweeps and processors (added by F-204/F-505/F-701) and the relay scheduler in worker mode.
