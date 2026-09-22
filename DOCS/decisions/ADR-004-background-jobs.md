# ADR-004: Background jobs: BullMQ on Redis, with lazy gate evaluation

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-05 §5.4, REQ-13 §13.4, REQ-19

## Decision
BullMQ queues: `training` (deadline expiry notifications), `mis-import` (pipeline stages), `notifications` (outbox fan-out + push), `files` (scan), `payouts` (stale-request flags). The API image runs as `worker` via `WORKER_MODE=1`.

**Every access gate is also evaluated from persisted timestamps at request time** (e.g. `deadlineAt < now() && !allPassed ⇒ deactivated`), so a lost job can never grant access it should have removed. Jobs materialise state (write the `EXPIRED_DEACTIVATED` status, send the notification) but are not the source of truth for the decision.

## Consequences
Redis becomes a required service. Idempotent job handlers keyed by entity id.
