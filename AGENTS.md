# AGENTS.md — how to work in this repository

You are working on **KBS Solutions**: a credit-card-only DSA platform (Android app + web admin + API) for KBS. This file is the entry point for every session, human or AI. Read it fully before touching code.

## 0. Non-negotiable product rule
> **Only Admin-uploaded bank MIS Excel is authoritative for bank application stage, final decision, activation, KYC and bank remarks.** No app action, link click, telephony event, note or payout may set a bank value (INV-01). Blank/`#N/A` means *unknown* (INV-02). Stage, decision and activation are separate fields (INV-03). One payable card event is paid once (INV-06). Never auto-match MIS rows by name/mobile (INV-08).

All ten invariants: `DOCS/requirements/REQ-00-document-authority-and-interpretation.md` §0.4.

## 1. Where the truth lives
| Question | Read |
|---|---|
| What must the product do? (verbatim, exhaustive) | `DOCS/requirements/REQ-xx-*.md` |
| What is ambiguous / missing and how did we resolve it? | `DOCS/analysis/01-gap-analysis.md` |
| How is it built (decisions)? | `DOCS/decisions/ADR-*.md` |
| System / data model / API / security | `DOCS/architecture/*.md` |
| What is the next unit of work and its status? | `DOCS/features/README.md` (index) and `DOCS/features/F-xxx-*.md` |
| Where did the last session stop? | `DOCS/PROGRESS.md` |
| Coding / git / testing rules | `DOCS/conventions/01-engineering-conventions.md` |
| Run it locally | `DOCS/runbooks/01-local-setup.md` |

## 2. Session start protocol (do this every time)
1. Read `DOCS/PROGRESS.md` — it says what is done, what is in progress, and the exact next step.
2. Open the feature file it points at (`DOCS/features/F-xxx-*.md`). Read the REQ sections it lists. Do not start from memory of the PRD; start from the files.
3. Run `pnpm install && pnpm typecheck` to confirm the tree is green before changing anything.
4. Set the feature status to `IN_PROGRESS` in the feature file and in `DOCS/features/README.md`; commit `docs(F-xxx): start`.

## 3. Session end protocol (never skip)
1. Ensure `pnpm typecheck && pnpm lint && pnpm test` pass (or record exactly what fails and why in PROGRESS.md).
2. Update the feature file: status, checked acceptance criteria, notes, follow-ups.
3. Update `DOCS/PROGRESS.md`: what changed, next step, any new open questions.
4. If you changed the data model or API, update `DOCS/architecture/03-data-model.md` / `04-api-conventions.md`.
5. Commit in small conventional commits (see conventions). Last commit of a session is `docs(progress): …`.

## 4. Working rules
- **One feature file at a time.** They are sized to finish in a session. If it is not, split it (create `F-xxx-b`) and say so in PROGRESS.md.
- **Commit each small task.** Scaffold → commit. Schema → commit. Service → commit. Tests → commit.
- **Never fill an OPEN item with a silent guess.** If the PRD marks it OPEN, look in the gap analysis for the disposition. If it is BLOCKED, build the structure and fail closed; add a `SystemConfig` key with `requiresValueBeforeProd=true`.
- **Requirements text is verbatim.** Do not edit `DOCS/requirements/` except to append a clearly marked `> ENGINEERING NOTE (date):` block. Deviations go to the gap analysis or an ADR.
- **Provenance everywhere.** Any DTO with a status carries `provenance` and `asOf`.
- **No new UI framework.** shadcn/ui on web; react-native-reusables + in-house on mobile (ADR-003). Tamagui and full UI kits are forbidden by the PRD.
- **No bank-status API integrations**, ever (REQ-28 §28.1).
- Tests for invariants are named `INV-xx`; tests for QA matrix rows are named by their id (`MIS-03`, `PAY-02`…).

## 5. Layout
```
apps/api (NestJS)  apps/web (Next.js+shadcn)  apps/mobile (Expo)
packages/db (Prisma)  packages/shared (Zod contracts)  packages/ui-tokens  packages/config
DOCS/ (everything above)  docker/ (postgres, redis, minio)
```

## 6. Commands
`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm infra:up`

## 7. Feature numbering
- F-0xx foundation/tooling · F-1xx auth/users/config/audit · F-2xx training · F-3xx telecaller ops (network, calling list, calling, sharing) · F-4xx advisor (onboarding, catalogue, leads) · F-5xx MIS · F-6xx payouts/accounts · F-7xx dashboards/notifications · F-8xx web/mobile UX shells & screens · F-9xx hardening/compliance.
