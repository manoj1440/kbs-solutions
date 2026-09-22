# Monorepo structure

Package manager: **pnpm 10** (workspaces). Task runner: **Turborepo 2**. Node **22 LTS**. TypeScript **5.9**, `strict: true` everywhere.

```
kbs-solutions/
├── AGENTS.md                  ← entry point for any AI/engineer session (read first)
├── CLAUDE.md                  ← one line: "Read AGENTS.md"
├── DOCS/
│   ├── README.md              ← map of all docs
│   ├── PROGRESS.md            ← session memory: what is done, what is next, how to resume
│   ├── requirements/          ← verbatim PRD (REQ-00 … REQ-30) — the source of truth for *what*
│   ├── analysis/              ← gap analysis (why we deviate/extend)
│   ├── decisions/             ← ADR-xxx engineering decisions — the source of truth for *how*
│   ├── architecture/          ← system, monorepo, data model, API conventions, security
│   ├── features/              ← F-xxx small feature files with status — the unit of work
│   ├── conventions/           ← coding, git, testing, naming rules
│   └── runbooks/              ← local setup, seeding, common commands
├── apps/
│   ├── api/                   ← NestJS (HTTP + worker mode)
│   ├── web/                   ← Next.js + shadcn/ui
│   └── mobile/                ← Expo + Expo Router
├── packages/
│   ├── db/                    ← Prisma schema, migrations, seed, client extensions
│   ├── shared/                ← Zod contracts, enums, constants, helpers
│   ├── ui-tokens/             ← design tokens for web and mobile
│   └── config/                ← tsconfig / eslint / prettier presets
├── docker/
│   └── docker-compose.yml     ← postgres, redis, minio
├── .github/workflows/ci.yml
├── package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
```

## Root scripts

| Script | Does |
|---|---|
| `pnpm dev` | turbo dev for api + web (mobile started separately with `pnpm --filter mobile start`) |
| `pnpm build` | turbo build all |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | across workspace |
| `pnpm db:migrate` / `pnpm db:generate` / `pnpm db:seed` / `pnpm db:studio` | proxies into `packages/db` |
| `pnpm infra:up` / `pnpm infra:down` | docker compose |

## Dependency direction

`apps/*` → `packages/shared`, `packages/ui-tokens`, `packages/db` (api only). Packages never import from apps. `packages/shared` has **no** runtime dependency on Prisma; enums are declared once in `shared` and mirrored in the Prisma schema (a test asserts they stay in sync).

## Naming

- Packages: `@kbs/<name>`. Apps: `api`, `web`, `mobile` (no scope, referenced with `--filter`).
- Files: kebab-case. Nest: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts` where a repository abstraction is useful, `dto/` holding Zod-derived DTO classes.
- Feature ids `F-xxx` appear in commit scopes and PR titles.
