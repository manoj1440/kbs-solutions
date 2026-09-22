# ADR-001: Monorepo with pnpm workspaces + Turborepo

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-20 §20.1 (shared design system), REQ-30 (shadcn monorepo guidance)

## Context
Three deployables (API, web, Android app) share contracts, enums, tokens and a DB client. The user mandated a monorepo.

## Decision
pnpm 10 workspaces, Turborepo 2 for task orchestration and caching, TypeScript project references via `tsconfig.base.json`. Apps under `apps/`, libraries under `packages/` scoped `@kbs/*`.

## Consequences
One `pnpm install`, one lint/typecheck/test command, atomic commits across API and clients. Expo and Next both support pnpm workspaces; Expo needs `metro.config.js` watchFolders for the workspace root (done in F-003).

## Alternatives
Nx (heavier, more opinionated), Yarn Berry (fine, but pnpm strictness catches phantom deps).
