# ADR-002: Backend: NestJS + Prisma + PostgreSQL

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-03 §3.3, REQ-13, REQ-17, REQ-24

## Context
The PRD's server-side surface is large: RBAC on every object, idempotent imports, atomic reservations, audit trails, background jobs. The user chose NestJS + Prisma + PostgreSQL.

## Decision
NestJS 11 (modules per domain, guards/interceptors for the cross-cutting pipeline). Prisma 7 with the `pg` driver adapter and PostgreSQL 16. Zod for validation (via `nestjs-zod`) so `@kbs/shared` schemas are the DTOs. Jest for tests. pino for logging. BullMQ for jobs (ADR-004).

## Consequences
Strong structure for a multi-session build. Prisma 7 requires `prisma.config.ts` and a driver adapter; documented in the db package README. Raw SQL is used for partial unique indexes and read-model views (Prisma migrations carry them).

## Alternatives
Fastify+Drizzle, Hono+Drizzle — lighter but more hand-wiring for the RBAC/audit surface.
