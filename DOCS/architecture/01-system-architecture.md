# System architecture

## 1. Shape of the system

```
┌──────────────────────┐   ┌──────────────────────┐
│  apps/mobile (Expo)  │   │  apps/web (Next.js)  │
│  Android APK         │   │  shadcn/ui, App Router│
│  Telecaller, Advisor,│   │  Admin, Manager,      │
│  Manager             │   │  Accounts             │
└──────────┬───────────┘   └──────────┬───────────┘
           │ HTTPS/JSON (OpenAPI)     │
           └────────────┬─────────────┘
                        ▼
              ┌────────────────────┐
              │  apps/api (NestJS) │  REST, server-side RBAC, audit
              │  modules per domain│
              └──┬─────────┬───────┘
                 │         │ BullMQ
        Prisma   │         ▼
                 │   ┌──────────────┐        ┌─────────────────┐
                 │   │ apps/api     │        │  Object storage │
                 │   │ (worker mode)│──────▶ │  S3 / MinIO     │
                 │   └──────────────┘        └─────────────────┘
                 ▼
        ┌────────────────┐     ┌──────────┐
        │  PostgreSQL 16 │     │  Redis 7 │
        └────────────────┘     └──────────┘

External ports (adapters swapped by env):  OTP · Telephony · WhatsApp · KYC(Aadhaar) · PAN · Push · Scan
```

Single-tenant. One API process image runs in two modes: `api` (HTTP) and `worker` (BullMQ processors). Same code, same Prisma client, so business rules never diverge between request path and job path.

## 2. Backend (apps/api)

NestJS 11, TypeScript strict. One Nest module per business domain, mirroring `DOCS/features/` groups:

| Module | Responsibility | PRD |
|---|---|---|
| `auth` | Mobile+OTP login, sessions, refresh rotation, device records | REQ-04 |
| `users` | Users, roles, lifecycle events, reporting assignments, agent codes | REQ-03, REQ-10 §10.4 |
| `config` | `SystemConfig` with history, launch-gate checklist | REQ-28 |
| `audit` | Append-only audit log + sensitive-access log, request-id correlation | REQ-24 §24.3 |
| `access-policy` | Office network allowlist, WFH exceptions, network-context evaluation | REQ-09 |
| `training` | Modules, MCQs, enrollments, attempts, 72-h gate, reactivation | REQ-05 |
| `calling-list` | Customer list import, validation, allocation, queues, suppression | REQ-06 |
| `catalogue` | Cards, categories, links (versioned), PDFs, product-code crosswalk | REQ-07 |
| `pincode` | Bank pincode profiles + rows, PincodeMaster, sourceability lookup | REQ-07 |
| `telephony` | Call initiation, provider events, recordings, outcomes, interests | REQ-08 |
| `sharing` | WhatsApp share actions and results, official ID card | REQ-08 §8.4–8.5 |
| `advisor-onboarding` | Signup steps, KYC/PAN/bank verification states, cheque upload | REQ-10 |
| `leads` | Advisor lead creation, link initiation events, bank linkage, My Leads | REQ-11 |
| `mis` | Import profiles, batches, staged pipeline, matching, quarantine, apply, history | REQ-13, REQ-14 |
| `payouts` | Rules, rates, entitlements, requests, dual approval, Accounts payment records | REQ-17, REQ-18 |
| `notifications` | Outbox → in-app + push, role/ownership scoping, deep links | REQ-19 |
| `dashboards` | Read models / SQL views per role with denominators and provenance | REQ-15, REQ-16 |
| `files` | Upload, scan status, presigned URLs, access checks | REQ-24 §24.4 |
| `providers` | Port interfaces + mock adapters | REQ-28 §28.1 |

Cross-cutting: `common/` (guards, decorators, interceptors, filters, pagination, masking, idempotency).

### Request pipeline
`RequestIdMiddleware → Helmet/CORS → ThrottlerGuard → JwtAuthGuard → RolesGuard → PolicyGuard(network, training, onboarding) → ZodValidationPipe → handler → AuditInterceptor → ResponseEnvelope`.

Every mutating endpoint accepts an `Idempotency-Key` header; the `IdempotencyInterceptor` stores the first response for 24 h keyed by (userId, key, route).

### Data-write discipline
- Bank-status columns are written only by `mis/apply.service.ts`. A Prisma client extension in `packages/db` rejects writes to `BankStatusSnapshot` unless the call is tagged `misApply` — a runtime guard for INV-01.
- Payout state changes go through `payouts/ledger.service.ts` which always appends a `PayoutEntitlementEvent` in the same transaction.
- `AuditLog` rows are written by interceptor for all mutations and explicitly by services for domain events.

## 3. Web (apps/web)

Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (the PRD-mandated component library; ADR-003). Server components for data tables, client components for forms. Auth via httpOnly cookies set by the API (`/auth/web/session`) so the browser never handles raw tokens. Role gates at the route-group level: `app/(admin)`, `app/(manager)`, `app/(accounts)`.

## 4. Mobile (apps/mobile)

Expo SDK 57 dev-client, Expo Router, React Native 0.87. UI built with **react-native-reusables** (shadcn-style RN registry, ADR-003) plus in-house components, both consuming `packages/ui-tokens`. Secure storage for refresh tokens (`expo-secure-store`). `expo-screen-capture` for FLAG_SECURE on protected screens. Role groups: `app/(telecaller)`, `app/(advisor)`, `app/(manager)`.

## 5. Shared packages

| Package | Contents |
|---|---|
| `@kbs/shared` | Zod schemas (request/response contracts), enums, provenance types, constants, formatting helpers (INR, masking), error codes |
| `@kbs/db` | Prisma schema, migrations, generated client, seed, client extensions (bank-status write guard) |
| `@kbs/ui-tokens` | Design tokens (colour, spacing, radius, typography) as TS + CSS variables; consumed by Tailwind (web) and NativeWind (mobile) |
| `@kbs/config` | Shared `tsconfig`, ESLint flat config, Prettier |

## 6. Environments

`docker/docker-compose.yml`: Postgres 16, Redis 7, MinIO. `.env.example` in every app. Dev OTP provider prints codes to the API log and accepts `000000` when `OTP_DEV_MASTER_CODE` is set.

## 7. Security baseline (core)

- OTP-only auth (no passwords exist in the schema).
- JWT access (15 min) + rotating refresh (30 d) with reuse detection → session family revoke.
- RBAC + ownership checks in guards **and** in service queries (scoped `where` builders per role).
- PAN encrypted at rest (AES-256-GCM, envelope key from env `DATA_ENCRYPTION_KEY`); Aadhaar number never persisted.
- All DTOs masked by default; `?reveal=true` requires permission and logs `SensitiveAccessLog`.
- Rate limits on OTP send/verify per mobile and IP.
- Helmet, strict CORS, cookie `SameSite=Lax; Secure; HttpOnly` for web.

## 8. Testing strategy

- Unit: Vitest in `packages/*`, Jest in `apps/api` (Nest defaults) for services and pure rules (matching, payout math, training gate).
- Integration: Jest + Testcontainers-style Postgres via docker-compose for repository-level tests of invariants (double reservation, idempotent import).
- E2E API: supertest against Nest app with a test DB.
- Web: Playwright smoke (login, role redirect). Mobile: Maestro flows (later).
- Every feature file names the QA-matrix ids (REQ-27) it must make pass.
