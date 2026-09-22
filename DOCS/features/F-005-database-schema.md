# F-005 `@kbs/db` Prisma schema — full domain

- Group: Foundation · Status: **PLANNED** · Depends on: F-001, F-002, F-004 · ADR-002, ADR-005, ADR-008, ADR-011, ADR-012
- PRD refs: REQ-22 (conceptual model), REQ-13 §13.2 (36 HDFC columns), REQ-17, REQ-06, REQ-07 §7.2, and `DOCS/architecture/03-data-model.md`

## Scope
- `packages/db/prisma/schema.prisma` implementing every entity in the data-model doc, generator `prisma-client` (Prisma 7) with `pg` driver adapter, `prisma.config.ts`.
- Initial migration `0001_init` + raw SQL migration `0002_constraints` for: one-ADMIN partial unique index; one open ReportingAssignment per child; one active PayoutRequestItem per entitlement; `BankApplicationLinkage(bankId, referenceKind, referenceValue)` unique; batch checksum unique per bank; indexes on `(assignedTelecallerUserId, hiddenAt, nextFollowUpAt)`, `(bankId, pincode)`, `(leadId, batchId, field)`.
- `src/index.ts` exporting a `createPrismaClient()` with the **bank-status write guard extension**: throws `BANK_STATUS_WRITE_FORBIDDEN` for `BankStatusSnapshot`/`BankStatusHistory` writes unless called inside `withMisApplyContext()` (AsyncLocalStorage flag).
- `src/seed.ts`: single Admin from env; `SystemConfig` defaults with `requiresValueBeforeProd` flags (full key list in F-104); default card categories (Travel, Shopping, Premium/Top, Fuel, Other); banks from REQ-07 §7.2 (EQUITAS, IDFC, HSBC, INDUSIND, RBL, AU, YES, AXIS, SBI) + HDFC; **HDFC MIS import profile v1** with all 36 headers mapped (F-501); **no PayoutRule** (fails closed).
- Enum sync test: Prisma enums === `@kbs/shared` enums.
- README documenting Prisma 7 specifics.

## Acceptance criteria
- [ ] `prisma validate`, `prisma migrate deploy` on fresh DB, `prisma generate` succeed.
- [ ] Seed is idempotent (second run makes no changes).
- [ ] INV-01 guard test: writing `BankStatusSnapshot` outside the MIS context throws.
- [ ] Second `ADMIN` insert fails at DB level (INV/RBAC).
