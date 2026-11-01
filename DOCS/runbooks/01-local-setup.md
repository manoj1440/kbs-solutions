# Local setup

```bash
# prerequisites: Node 22, pnpm 10 (corepack enable), Docker
pnpm install
pnpm infra:up                 # postgres:5432, redis:6379, S3 storage (RustFS, service "minio") :9000, console :9001
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
pnpm db:migrate               # applies migrations
pnpm db:seed                  # creates the single Admin from BOOTSTRAP_ADMIN_MOBILE, config defaults, categories
pnpm dev                      # api on :4000, web on :3000
pnpm --filter mobile start    # Expo dev server (dev-client build needed once: see mobile README)
```

Dev OTP: with `OTP_PROVIDER=console` codes print in the API log; `OTP_DEV_MASTER_CODE=000000` also accepts that code.

## Useful
- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `pnpm db:studio` — Prisma Studio
- `pnpm --filter api test -- -t INV-` — run invariant tests only
- API docs: http://localhost:4000/api/docs

## Web e2e (Playwright) — on a disposable database
```bash
bash apps/web/test/e2e-isolated.sh            # full suite, desktop + phone
bash apps/web/test/e2e-isolated.sh e2e/admin-smoke.spec.ts -g F-808   # any playwright args
```
Recreates `kbs_e2e` in the `kbs-test-pg` container (migrations + baseline seed), starts its own api (:4300, Redis db 3,
memory storage) and a production web build (`.next-e2e`, :3300), runs Playwright, then stops both. The dev stack
(:3000/:4000, `kbs_dev`) keeps running and is never written to. `E2E_SKIP_BUILD=1` reuses the last web build;
`E2E_KEEP=1` leaves the servers up for debugging. It refuses to recreate `kbs_dev`, `kbs_base` or `kbs_test`.
This mirrors the CI `web-e2e` job. Do not point the suite at `kbs_dev` (`E2E_PG_DB=kbs_dev`): every run used to add
an "E2E … Manager" or an unnamed Advisor there — `apps/web/test/e2e-users-in-dev.sql` lists them (SELECT only).


## Storage
Local files (benefit PDFs, training videos, uploads) go to the S3-compatible container from `pnpm infra:up` with `STORAGE_PROVIDER=s3` (the `.env.example` default). MinIO no longer publishes public images, so the `minio` service runs RustFS (same `MINIO_ROOT_*` credentials, bucket `kbs-private` created by `minio-init`). `STORAGE_PROVIDER=memory` also works but presigned URLs are `memory://…` (benefit PDF links do not open) and files are lost on every API restart — use it only for tests.
