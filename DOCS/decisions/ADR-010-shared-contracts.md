# ADR-010: Shared Zod contracts as the single API contract

- Status: Accepted · Date: 2026-09-22

## Decision
`@kbs/shared` exports Zod schemas for every request body, query and response DTO, plus enums and error codes. The API validates with them (`nestjs-zod`), generates OpenAPI from them, and web/mobile import the inferred types and a typed fetch client (`packages/shared/src/client`). Enums are declared in `shared` and mirrored in Prisma; a unit test in `@kbs/db` asserts equality.
