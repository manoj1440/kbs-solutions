# api

NestJS 11 API for KBS Solutions. Runs as HTTP server (default) or BullMQ worker (`WORKER_MODE=1`).

```
cp .env.example .env            # fill secrets
pnpm --filter api dev           # http://localhost:4000/api/v1 (docs at /api/docs)
pnpm --filter api test          # unit tests
DATABASE_URL=postgresql://kbs:kbs@localhost:5432/kbs_test pnpm --filter api test:e2e
```

Structure: `src/common` (guards, interceptors, errors, request context, crypto), `src/infra` (Prisma, Redis),
`src/providers` (ports + mock adapters, ADR-009), `src/modules/<domain>` (one Nest module per feature group).
Every protected route declares `@RequirePermission(...)`; gates via `@RequireGates(...)`; side-effecting POSTs use
`@Idempotent()` and `@Audited(...)`. See `DOCS/architecture/01-system-architecture.md`.
