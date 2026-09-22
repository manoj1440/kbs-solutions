# @kbs/db

Prisma 7 schema, migrations, seed and the guarded client for KBS Solutions.

- `prisma/schema.prisma` — executable data model (mirror of `DOCS/architecture/03-data-model.md`).
- `prisma/migrations/` — Prisma-generated SQL (`*_init`) plus hand-written constraints (`*_constraints`: partial unique indexes such as the single-Admin rule and one-active-request-per-entitlement).
- `src/client.ts` — `createPrismaClient()` with the **INV-01 write guard**: any write to `BankStatusSnapshot` / `BankStatusHistory` outside `withMisApplyContext()` throws `BankStatusWriteForbiddenError`.
- `src/seed.ts` — idempotent seed (single Admin, config defaults, categories, banks, HDFC MIS profile v1, nine pincode profiles as DRAFT, example links as DRAFT cards, **no payout rules**).

## Commands
```
pnpm --filter @kbs/db generate       # prisma generate (falls back to a stub engine path when the download is blocked)
pnpm --filter @kbs/db migrate:dev    # create + apply a migration (needs network for the Prisma engine)
pnpm --filter @kbs/db migrate:deploy # apply pending migrations
pnpm --filter @kbs/db migrate:offline# apply pending migrations with the WASM engine (no download needed)
pnpm --filter @kbs/db seed
pnpm --filter @kbs/db test           # needs DATABASE_URL; runs INV-01 / single-admin / enum-sync tests
```

## Prisma 7 notes
- Connection URL lives in `prisma.config.ts` (from `DATABASE_URL`), not in the schema.
- The client uses the `pg` driver adapter (`@prisma/adapter-pg`); no Rust query engine at runtime.
- The `prisma-client` generator emits TypeScript into `generated/prisma` (git-ignored; regenerated on build).
- Enum `CallOutcomeKind` maps to the shared enum `CallOutcome` (Postgres forbids an enum and a table sharing a name).

## Offline migrations (`scripts/wasm-migrate.mjs`)
Uses `@prisma/schema-engine-wasm` (the same engine the CLI ships) so migrations can be applied where `binaries.prisma.sh` is unreachable. `create` only supports the first migration; incremental migrations are generated with the normal CLI.
