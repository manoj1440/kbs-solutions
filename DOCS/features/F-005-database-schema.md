# F-005 `@kbs/db` Prisma schema — full domain

- Group: Foundation · Status: **DONE** · Depends on: F-001, F-002, F-004 · ADR-002, ADR-005, ADR-008, ADR-011, ADR-012
- PRD refs: REQ-22 (conceptual model), REQ-13 §13.2 (36 HDFC columns), REQ-17, REQ-06, REQ-07 §7.2, and `DOCS/architecture/03-data-model.md`

## Scope
- `packages/db/prisma/schema.prisma` implementing every entity in the data-model doc, generator `prisma-client` (Prisma 7) with `pg` driver adapter, `prisma.config.ts`.
- Initial migration `0001_init` + raw SQL migration `0002_constraints` for: one-ADMIN partial unique index; one open ReportingAssignment per child; one active PayoutRequestItem per entitlement; `BankApplicationLinkage(bankId, referenceKind, referenceValue)` unique; batch checksum unique per bank; indexes on `(assignedTelecallerUserId, hiddenAt, nextFollowUpAt)`, `(bankId, pincode)`, `(leadId, batchId, field)`.
- `src/index.ts` exporting a `createPrismaClient()` with the **bank-status write guard extension**: throws `BANK_STATUS_WRITE_FORBIDDEN` for `BankStatusSnapshot`/`BankStatusHistory` writes unless called inside `withMisApplyContext()` (AsyncLocalStorage flag).
- `src/seed.ts`: single Admin from env; `SystemConfig` defaults with `requiresValueBeforeProd` flags (full key list in F-104); default card categories (Travel, Shopping, Premium/Top, Fuel, Other); banks from REQ-07 §7.2 (EQUITAS, IDFC, HSBC, INDUSIND, RBL, AU, YES, AXIS, SBI) + HDFC; **HDFC MIS import profile v1** with all 36 headers mapped (F-501); **no PayoutRule** (fails closed).
- Enum sync test: Prisma enums === `@kbs/shared` enums.
- README documenting Prisma 7 specifics.

## Acceptance criteria
- [x] `prisma validate`, `prisma migrate deploy` on fresh DB, `prisma generate` succeed.
- [x] Seed is idempotent (second run makes no changes).
- [x] INV-01 guard test: writing `BankStatusSnapshot` outside the MIS context throws.
- [x] Second `ADMIN` insert fails at DB level (INV/RBAC).

## Progress notes
- 2026-09-22 (session 1): Schema (57 enums, 60+ models), migrations `*_init` (Prisma-generated via WASM engine) + `*_constraints`, INV-01 guard extension, idempotent seed, 6 tests. Offline migrate runner `scripts/wasm-migrate.mjs` documented in packages/db/README.md.
