# Local setup

```bash
# prerequisites: Node 22, pnpm 10 (corepack enable), Docker
pnpm install
pnpm infra:up                 # postgres:5432, redis:6379, minio:9000/9001
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
