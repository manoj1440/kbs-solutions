# ADR-011: Single-tenant, one Admin

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-03 §3.1

## Decision
No organisation/tenant column. Exactly one `ADMIN` user enforced by DB. Revisit only on explicit business change; adding a tenant key later is a mechanical migration because all scoping already flows through one `Actor` object.
