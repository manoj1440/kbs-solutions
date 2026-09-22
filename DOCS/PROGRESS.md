# PROGRESS — session memory

> Update this file at the end of every session (see AGENTS.md §3). Newest entry first. Keep "Current state" accurate: a new chat must be able to resume from it alone.

## Current state (as of 2026-09-22, end of session 2)

- **Phase:** Vertical slice 1 (Telecaller lifecycle) **done**; vertical slice 2 (calling desk: F-306, F-304, F-303, F-305, F-403, F-404, F-308, F-307, F-312, F-309, F-310, F-311, F-313) **done**. Next: slice 3 (Advisor: F-401, F-402, F-405, F-406, F-407).
- **Green checks:** `pnpm turbo run typecheck lint test` → 21/21 tasks; API e2e **56/56** across 13 suites (`DATABASE_URL=…/kbs_test pnpm --filter api test:e2e`); web pages verified in a headless browser after every feature (login, import wizard, allocation/distribution, catalogue editor, pincode profiles, verify page, team ops); mobile typechecks/lints (Expo screens not run on a device in the sandbox).
- **Feature status:** 32 DONE, 8 IN_PROGRESS (screens pending from slice 1), 30 PLANNED, 1 BLOCKED — see `DOCS/features/README.md` (statuses + "Progress notes" per file are the source of truth).
- **API surface added in slice 2 (all under `/api/v1`):** `/calling-list/*` (import wizard, review, allocate), `/calling/queue|records|distribution|team/*`, `/calls` + `/webhooks/telephony/:provider` + `/calls/:id/recording-url`, `/calling/records/:id/{cards,calls,outcomes,remarks,shares,reassign}`, `/catalogue/*`, `/pincode-profiles/*`, `/pincode-batches/*`, `/sourceability/:pincode`, `/cards/available`, `/share`, `/r/:token`, `/webhooks/whatsapp/delivery`, `/id-cards/me[.svg]`, `/users/:id/id-card[/regenerate]`, public `/verify/:publicRef`, `/suppressions/*`, `/pincodes/*`.
- **Web pages added:** Admin `/admin/calling-list[/id]`, `/admin/calling-list/distribution[/telecaller/id]`, `/admin/catalogue[/id]`, `/admin/pincode-profiles[/id]`, `/admin/compliance`; Manager `/manager/calling[/telecaller/id]`; public `/verify/[ref]`. Mobile Telecaller: queue tabs, record (call desk + outcome editor + cards), card detail (share buttons), official ID.
- **Decisions this session (not yet ADRs, record if they stick):** ID card rendered as SVG (no native rasteriser in the sandbox; `@resvg/resvg-js` can be added on a normal machine); PDF/ID shares go through an HMAC-signed `/r/<token>` redirect (7-day) rather than a table; REGION_PREFERRED allocation reads `allocation.regionPreferences` config (employeeCode → states) since User has no region field; training window starts only for `NOT_STARTED` enrollments.
- **Next step for a new session (in order):** F-401 Advisor onboarding (self-registration with Agent Code, KYC via port, PAN mock) → F-402 onboarding review → F-405 Advisor catalogue browse (reuse `CardAvailabilityService.available(pincode,'ADVISOR')`) → F-406 lead creation (declarations, bureau ack, idempotency) → F-407 link initiation + bank reference. Then slice 4 (MIS) per `DOCS/features/README.md`.
- **Sync procedure used from the cloud sandbox:** `git bundle` of new commits → written into the Mac folder as `.sync-<sha>.bundle` → `git fetch <bundle> main:refs/remotes/sync/main && git merge --ff-only` on the Mac. On a normal machine just push/pull.
- **Known environment caveats (not product blockers):**
  - The build sandbox could not reach `binaries.prisma.sh`, `ui.shadcn.com`, `fonts.googleapis.com`. Consequences: migrations were generated with the Prisma **WASM** engine (`packages/db/scripts/wasm-migrate.mjs`), which yields the same SQL as the CLI; shadcn components were hand-authored (identical to CLI output, `components.json` is ready for `npx shadcn add`); web uses a system font stack. On a normal machine `pnpm db:migrate:dev` and `npx shadcn add` work as usual.
  - `prisma generate` wrapper (`packages/db/scripts/generate.mjs`) falls back to a stub engine path when the download fails — harmless, generation never runs the engine.
- **Business blockers (unchanged, fail closed):** ★ config keys listed on the Admin overview page (payout designated approver, training thresholds/reactivation window, compliance confirmations incl. `compliance.callingListConsentConfirmedByCompliance`, `compliance.recordingDisclosureText`, `compliance.whatsappConsentPolicy`, retention, declarations). See `DOCS/analysis/01-gap-analysis.md`.

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
- Slice 1: F-106 Agent Codes (API + e2e FOS-02). F-201 Manager screens (web + mobile). F-108 files module (upload/sniff/presign, S3 + memory). F-202 training content admin (API + web editor). F-203 learner flow (API + mobile screens). F-204/F-205 expiry sweep, reactivation, progress views (API + web + mobile). Minimal notifications module (`GET /notifications`).
- Slice 2: F-306 suppression, F-304 pincode master, F-303 customer import wizard, F-305 allocation (auto + manual reassignment + distribution), F-307 calling queue + record detail (mobile), F-403 catalogue, F-404 bank pincode profiles + import + sourceability, F-308 card availability + publications, F-309 calls via telephony port + webhook + recordings, F-310 outcomes/remarks/interest/collision, F-312 official ID (SVG + verify), F-311 WhatsApp sharing, F-313 team ops views.
- API e2e: 56 tests across 13 suites; unit 13. Each feature committed and synced to the Mac after verification (typecheck, lint, tests, headless-browser checks of web pages).

### 2026-09-22 — Session 1 (initial)
- Analysed PRD end-to-end; wrote gap analysis (18 gaps, 11 ambiguities, risk table, better approaches) with dispositions.
- Created DOCS: verbatim requirements (REQ-00…30), 12 ADRs, architecture (system, monorepo, data model, API conventions, security), 71 feature files, conventions, runbooks, AGENTS.md.
- Built F-001…F-006 (tooling, infra, three app scaffolds, `@kbs/shared`, `@kbs/db` with full schema + migrations + seed + INV-01 guard, `@kbs/ui-tokens`).
- Built API core: OTP auth + sessions, RBAC + scoping, audit, SystemConfig + launch gates, users/hierarchy, idempotency, provider ports, jobs/outbox, gates, office-network policy + WFH. 16 e2e + 11 unit tests.
- Built web shell (login, role areas, admin overview/config/users) and mobile shell (login, gates, role tabs, SecureScreen).
- 16 commits, each a small task.
