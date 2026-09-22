# PROGRESS — session memory

> Update this file at the end of every session (see AGENTS.md §3). Newest entry first. Keep "Current state" accurate: a new chat must be able to resume from it alone.

## Current state (as of 2026-09-22, session 2 in progress)

- **Phase:** Vertical slice 1 (Telecaller lifecycle) **done**; slice 2 (calling desk) starts next.
- **Green checks:** `pnpm turbo run typecheck lint test` → 21/21 tasks; `pnpm build` → 5/5; API e2e 16/16 (`pnpm --filter api test:e2e` with `DATABASE_URL=…/kbs_test`); web login → admin overview verified in a real browser; mobile `expo export` bundles.
- **Feature status:** 19 DONE (F-001…006, 101–103, 106–111, 201–205, 108, 301 API), 8 IN_PROGRESS (screens pending), 43 PLANNED, 1 BLOCKED — see `DOCS/features/README.md`.
- **Next step for a new session (in order):** slice 2 — F-306 (suppression), F-304 (pincode master), F-303 (customer list import), F-305 (allocation), F-403/F-404 (catalogue + bank pincode profiles), F-308, F-307 (queue), F-312, F-309, F-310, F-311, F-313 — per the roadmap in `DOCS/features/README.md`.
- **Sync procedure used from the cloud sandbox:** `git bundle` of new commits → written into the Mac folder → `git fetch <bundle> main:refs/remotes/sync/main && git merge --ff-only` on the Mac. On a normal machine just push/pull.
- **Known environment caveats (not product blockers):**
  - The build sandbox could not reach `binaries.prisma.sh`, `ui.shadcn.com`, `fonts.googleapis.com`. Consequences: migrations were generated with the Prisma **WASM** engine (`packages/db/scripts/wasm-migrate.mjs`), which yields the same SQL as the CLI; shadcn components were hand-authored (identical to CLI output, `components.json` is ready for `npx shadcn add`); web uses a system font stack. On a normal machine `pnpm db:migrate:dev` and `npx shadcn add` work as usual.
  - `prisma generate` wrapper (`packages/db/scripts/generate.mjs`) falls back to a stub engine path when the download fails — harmless, generation never runs the engine.
- **Business blockers (unchanged, fail closed):** ★ config keys listed on the Admin overview page (payout designated approver, training thresholds/reactivation window, compliance confirmations, retention, declarations). See `DOCS/analysis/01-gap-analysis.md`.

## Decisions taken this session (already recorded in ADRs)
Stack: NestJS 11 + Prisma 7 (pg adapter) + PostgreSQL 16 + Redis/BullMQ; Next.js 16 + Tailwind v4 + shadcn/ui; Expo SDK 57 + Expo Router + NativeWind; pnpm + Turborepo. Single-tenant, one Admin, OTP-only. Enum `CallOutcomeKind` (Prisma) ↔ `CallOutcome` (shared) because Postgres forbids an enum and a table with the same name.

## How to run what exists
```
pnpm install && pnpm infra:up
cp apps/api/.env.example apps/api/.env   # set JWT_* (≥32 chars), DATA_ENCRYPTION_KEY (32-byte base64)
cp packages/db/.env.example packages/db/.env && cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate && pnpm db:seed          # single Admin from BOOTSTRAP_ADMIN_MOBILE
pnpm dev                                 # api :4000 (docs /api/docs), web :3000 — OTP prints in the API log; 000000 works in dev
```

## Session log

### 2026-09-22 — Session 2
- F-106 Agent Codes (API + e2e FOS-02). F-201 Manager screens (web + mobile). F-108 files module (upload/sniff/presign, S3 + memory). F-202 training content admin (API + web editor). F-203 learner flow (API + mobile screens). F-204/F-205 expiry sweep, reactivation, progress views (API + web + mobile). Minimal notifications module (`GET /notifications`).
- API e2e: 25 tests across 6 suites; unit 13. Each feature committed and synced to the Mac after verification.

### 2026-09-22 — Session 1 (initial)
- Analysed PRD end-to-end; wrote gap analysis (18 gaps, 11 ambiguities, risk table, better approaches) with dispositions.
- Created DOCS: verbatim requirements (REQ-00…30), 12 ADRs, architecture (system, monorepo, data model, API conventions, security), 71 feature files, conventions, runbooks, AGENTS.md.
- Built F-001…F-006 (tooling, infra, three app scaffolds, `@kbs/shared`, `@kbs/db` with full schema + migrations + seed + INV-01 guard, `@kbs/ui-tokens`).
- Built API core: OTP auth + sessions, RBAC + scoping, audit, SystemConfig + launch gates, users/hierarchy, idempotency, provider ports, jobs/outbox, gates, office-network policy + WFH. 16 e2e + 11 unit tests.
- Built web shell (login, role areas, admin overview/config/users) and mobile shell (login, gates, role tabs, SecureScreen).
- 16 commits, each a small task.
