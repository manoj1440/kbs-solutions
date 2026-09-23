# Engineering conventions

## Language & style
- TypeScript strict everywhere; no `any` (use `unknown` + narrowing). ESLint flat config from `@kbs/config`, Prettier (100 cols, single quotes, trailing commas).
- Dates: `Date` in UTC internally; formatting only at the edge with `date-fns-tz` in `Asia/Kolkata`. Never derive bank event dates from upload time (REQ-13 §13.8).
- Money: `Prisma.Decimal` / string in DTOs, never JS `number` for INR amounts.
- Phone numbers: normalise to E.164 (`+91XXXXXXXXXX`) at the boundary with `libphonenumber-js`; store E.164.
- Pincode: always `string` length 6; never parse to number (REQ-07 §7.3).
- Bank MIS values: store the exact cell text; display through `formatBankValue()` from `@kbs/shared` which returns `Not reported` for blank/`#N/A`.

## Backend rules
1. Controllers: parse + authorise + call one service method. No Prisma in controllers.
2. Services receive `Actor` and apply scope. Never trust ids from the client without a scope check.
3. Any write to bank status outside `mis/apply` is a bug — the Prisma extension will throw.
4. Every mutation writes audit (interceptor for HTTP, explicit `auditService.record()` in jobs).
5. Side-effecting POSTs must accept `Idempotency-Key`; clients must send one (uuid v4).
6. Never log PII. Use `logger.info({ leadId }, 'msg')` — never include names, mobiles, PAN, tokens.
7. Errors: throw `AppError(ErrorCode.X, message, details?)`; the filter maps to HTTP status.
8. Migrations: `pnpm db:migrate:dev --name <feature-id>-<short>`; never edit an applied migration.

## Frontend rules
- All status badges use `<StatusBadge provenance=… />` from the app's ui folder; colour never carries meaning alone (REQ-20 §20.2) — text label always present.
- Distinct components for Stage, Decision, Activation, Payout state — never merged into one chip (REQ-14 §14.3).
- Forms: `react-hook-form` + Zod resolver using the same schema as the API.
- Web data tables: TanStack Table wrapped in shadcn `DataTable`.
- Mobile protected screens: wrap in `<SecureScreen>` (FLAG_SECURE).

## Git
- Trunk-based on `main`; branches `feat/F-xxx-short`, `fix/…`, `docs/…` when collaborating; solo work commits straight to `main` in small steps.
- Conventional Commits: `type(scope): summary` where scope is the feature id or package (`feat(F-101): …`, `chore(db): …`, `docs(features): …`).
- **Commit every small task.** A commit should build (or be docs-only). Reference the feature id.
- Before finishing a session: update `DOCS/PROGRESS.md` and the feature file status, commit `docs(progress): …`.

## Testing
- Pure rules (training gate, matching, payout math, masking, display formatting) get unit tests first.
- Invariants (INV-01…10) each have at least one automated test named `INV-xx` somewhere in the suite; `pnpm test -- -t INV-` runs them.
- QA-matrix ids (REQ-27) appear in test names, e.g. `it('MIS-03 #N/A activation shows Not reported')`.

## Definition of done for a feature file
Status `DONE` only when: acceptance criteria checked, tests named in the file pass, docs updated (data model/api if changed), PROGRESS.md updated, committed.

## Flaky tests (F-901 quarantine policy)
- A test that fails intermittently on `main` is **quarantined**, not deleted: append ` [quarantine]` to its title and open a follow-up in the owning feature file with the failure evidence.
- Blocking CI (`.github/workflows/ci.yml`) skips `[quarantine]` titles (Jest `--testNamePattern`, Playwright `grepInvert`); the nightly workflow runs everything twice and uploads the JSON reports.
- A quarantined test must be fixed or removed within two weeks; quarantine never applies to invariant tests (`INV-xx`) or money paths (`PAY-xx`) — those block until fixed.
- Root-cause races instead of adding sleeps (example: the audit interceptor now awaits its write, which removed the audit-count flakes).

## Automated test layers
| Layer | Where | Runs |
|---|---|---|
| Unit / contract | `packages/*/test`, `apps/*/src/**/*.spec.ts`, `apps/web/test` | `pnpm test` (CI verify; DB invariants need a baseline-seeded DB) |
| API e2e (REQ-27 ids) | `apps/api/test/*.e2e-spec.ts` | `pnpm --filter api test:e2e` (CI api-e2e, disposable DB) |
| Web e2e | `apps/web/e2e` (Playwright, desktop + phone widths) | `pnpm --filter web test:e2e` (CI web-e2e) |
| Mobile flows | `apps/mobile/.maestro` | before each APK release (F-906) |
| Performance | `perf/k6` | on demand + nightly smoke (F-905) |
| QA matrix | `node scripts/qa-matrix.mjs --write` → `DOCS/qa/qa-matrix.md` | CI ratchet `--min` |
