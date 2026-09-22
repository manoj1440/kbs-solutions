# ADR-012: Identifiers

- Status: Accepted · Date: 2026-09-22

## Decision
Internal PKs: UUIDv7 (time-sortable, generated in DB via Prisma `uuid(7)`). Public references shown to humans: prefix + 8 chars Crockford base32 from a CSPRNG, unique column: `KBS-L-` leads, `KBS-PR-` payout requests, `KBS-B-` import batches, `KBS-U-` users, `KBS-TC-` Telecaller employee codes. Public refs never embed dates, sequence or customer data (unguessable, non-enumerable).
