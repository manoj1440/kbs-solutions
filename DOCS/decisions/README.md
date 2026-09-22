# Architecture decision records

One file per decision. Status: Proposed → Accepted → (Superseded by ADR-xxx). Never delete; supersede.
Template: `ADR-000-template.md`.

| ADR | Title | Status |
|---|---|---|
| ADR-001 | Monorepo with pnpm workspaces + Turborepo | Accepted |
| ADR-002 | Backend: NestJS + Prisma + PostgreSQL | Accepted |
| ADR-003 | UI: shadcn/ui on web, react-native-reusables on mobile, shared tokens | Accepted |
| ADR-004 | Background jobs: BullMQ on Redis, with lazy gate evaluation | Accepted |
| ADR-005 | MIS import as staged, idempotent, append-only pipeline | Accepted |
| ADR-006 | Account creation authority and Admin bootstrap | Accepted |
| ADR-007 | Bank reference capture and linkage sources | Accepted |
| ADR-008 | Payout ledger, reservation and dual approval mechanics | Accepted |
| ADR-009 | Provider ports and mock adapters for all external vendors | Accepted |
| ADR-010 | Shared Zod contracts as the single API contract | Accepted |
| ADR-011 | Single-tenant, one Admin | Accepted |
| ADR-012 | Identifiers: UUIDv7 internal, Crockford public refs | Accepted |
