# F-001 Monorepo tooling

- Group: Foundation · Status: **DONE** · Depends on: — · Blocks: everything
- PRD refs: REQ-20 §20.1 (shared design system needs a monorepo), REQ-30 §30.2 (shadcn monorepo guidance), ADR-001

## Goal
A single `pnpm install` + `pnpm typecheck/lint/test/build` that works across API, web, mobile and packages, with Turborepo caching and CI.

## Scope
- `package.json` (root, private, `packageManager: pnpm@10`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (pipelines: build, dev, lint, typecheck, test, with `^build` deps and outputs).
- `tsconfig.base.json` (strict, ES2022, `moduleResolution: bundler`, path aliases `@kbs/*`).
- `packages/config`: `eslint` flat config (typescript-eslint, import ordering, no-console except logger), `prettier` config, base `tsconfig` variants (`base`, `node`, `nextjs`, `react-native`).
- `.editorconfig`, `.nvmrc` (22), `.npmrc` (`auto-install-peers`, `strict-peer-dependencies=false`, `node-linker=hoisted` **only for mobile if Metro requires**; default isolated).
- `.github/workflows/ci.yml`: install → typecheck → lint → test → build on push/PR; Postgres/Redis services for API tests.
- Root scripts as listed in `DOCS/architecture/02-monorepo-structure.md`.

## Acceptance criteria
- [x] `pnpm install` succeeds from a clean clone.
- [x] `pnpm typecheck && pnpm lint` succeed with empty apps.
- [x] Turbo caches a second `pnpm typecheck` run.
- [x] CI workflow file lints (actionlint not required, but YAML valid).

## Tests
None (tooling). Verified by running the commands.

## Progress notes
- 2026-09-22 (session 1): Root workspace, turbo (with env passthrough), tsconfig presets, eslint flat config, prettier, CI workflow. All acceptance criteria verified by running the commands.
