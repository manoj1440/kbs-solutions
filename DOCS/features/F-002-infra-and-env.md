# F-002 Local infrastructure and environment files

- Group: Foundation · Status: **DONE** · Depends on: F-001
- PRD refs: REQ-24 §24.4 (object storage), ADR-002, ADR-004

## Scope
- `docker/docker-compose.yml`: `postgres:16` (db `kbs`, user `kbs`, volume), `redis:7`, `minio` (+ `minio/mc` init container creating buckets `kbs-private`), healthchecks.
- `.env.example` for `apps/api`, `packages/db`, `apps/web`, `apps/mobile` with **every** variable documented inline: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY` (32-byte base64), `S3_*`, `OTP_PROVIDER=console`, `OTP_DEV_MASTER_CODE`, `BOOTSTRAP_ADMIN_MOBILE`, `BOOTSTRAP_ADMIN_NAME`, `WEB_ORIGIN`, `API_PORT=4000`, `WORKER_MODE`, `TZ=UTC`.
- Root scripts `infra:up` / `infra:down` / `infra:reset`.

## Acceptance criteria
- [x] `pnpm infra:up` brings up all three services healthy.
- [x] `.env` files are git-ignored; `.env.example` committed.

## Progress notes
- 2026-09-22 (session 1): docker-compose (postgres/redis/minio + bucket init), .env.example per app/package, infra scripts.
