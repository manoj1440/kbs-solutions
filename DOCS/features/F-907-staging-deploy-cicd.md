# F-907 Staging deployment on free tiers + CI/CD

- Group: Hardening · Status: **IN_PROGRESS** (code done; waits on the user's provider accounts + first deploy) · Depends on: F-901, F-906, F-819
- PRD refs: REQ-24 (operational acceptance), REQ-28 §28.2 (release gate)
- Origin: user request (2026-10-19): "deploy everything but only use free sources like Vercel and a MongoDB free cluster … do a solid analysis and implement complete CI/CD". Trigger: the S24 could not reach the developer Mac's API (router client isolation), so the forced-update test (F-819) needs a reachable API.

## 1. Analysis
| Finding | Consequence |
|---|---|
| CI red on `main` for every run: `pnpm … test:e2e -- --testNamePattern` passed a literal `--`, so Jest matched **no** test files ("No tests found"); web smoke seeded before `@kbs/shared` was built. | API e2e never ran in CI. Fixed (`--` dropped, shared built before seed; same `--` bug in nightly). Local run with the fixed command: 159/160, the one failure (`notifications` "socket hang up") passed 6/6 twice alone — existing flake. |
| Data model is PostgreSQL-only (Prisma postgresql, INV-01 trigger, `set_config` transactions, raw SQL). | MongoDB rejected (rewrite). |
| API runs BullMQ repeatable jobs every 5 min (training sweep, maintenance). | Neon free (compute-hour cap, would never sleep) rejected → **Supabase** free Postgres (no hour cap, Mumbai). Its S3-compatible storage replaces MinIO (one provider fewer). |
| BullMQ + pub/sub need Redis with `noeviction` and many commands. | Upstash free (command quota) rejected → **Render Key Value** free (same private network as the API). |
| One free process only (Render free; workers are paid). | `JOBS_INLINE=1`, `JOBS_DISPATCH=local`. |
| No SMS provider; `NODE_ENV=production` refuses console OTP. | New `NODE_ENV=staging`: secure cookies, error details hidden, Swagger off, login via a **secret** master code (guessable codes refused at boot). |
| Web auth = httpOnly cookies set by the API, read by Next server components. Vercel and Render are different sites. | Web calls the API same-origin: `NEXT_PUBLIC_API_URL=/api/v1` + Next rewrite to `API_URL` → cookies first-party. Local dev unchanged. |
| Render free sleeps after 15 min (≈1 min cold start). | `keep-warm.yml` pings `/health` every 10 min (public repo → free minutes; 750 h covers one service). |
| Vercel Hobby = non-commercial; Play Store / Apple accounts cost money. | Flagged in runbook 05; APKs from the EAS link. |

## 2. Decisions (recommended defaults, applied)
Supabase (DB + storage; free plan placed it in Seoul ap-northeast-2, ~70 ms from Render Singapore) · Render (API + Key Value, Singapore, `render.yaml`, deploy hook only) · Vercel Hobby (web, sin1, git deploys off) · EAS free (`preview` profile = staging API, channel `preview`) · GitHub Actions: CI → **Deploy staging** job (migrate → Render, wait for `/health.commit` = SHA → Vercel prebuilt → EAS OTA when mobile paths changed), manual seed input, manual APK build workflow, keep-warm schedule. Staging uses the Supabase owner role (runbook 03 stays the production procedure).

## 3. Phases
| Phase | Scope | Status |
|---|---|---|
| P1 | Fix red CI (e2e args, seed order) | DONE |
| P2 | API `staging` mode + `/health.commit`; web same-origin proxy; `render.yaml`, `vercel.json`, eas `preview` URL | DONE |
| P3 | Workflows: deploy job in `ci.yml`, `keep-warm.yml`, `mobile-build.yml`; runbook 05 | DONE |
| P4 | Provider setup (state below); first deploy with seed; verify web login, APK on staging, F-819 forced update on the S24 | IN_PROGRESS |

## 4. Acceptance
- [ ] CI green on `main` (all three jobs).
- [ ] A push to `main` deploys API + web automatically; `/health.commit` equals the pushed SHA.
- [ ] Web login on the Vercel URL with the Admin mobile + master code.
- [ ] A mobile-only change reaches the S24 as an OTA update without a new APK.
- [ ] F-819: `app.android.minVersion` above the installed version blocks the staging app.

## Progress notes
- 2026-10-19: P1–P3. Local rehearsal: API built and run with `NODE_ENV=staging` (Swagger 404, `/health.commit` from `RENDER_GIT_COMMIT`, master code `000000` refused at boot), web production build with `NEXT_PUBLIC_API_URL=/api/v1` → health through the rewrite and a full browser login to `/admin` (cookies on the web origin, server-rendered home). Checks: api unit 18/18 (new `env.spec.ts`), api + web typecheck/lint, workflow YAML parses.
- 2026-10-19 (P4, done in the in-app browser with the user signing in / entering secrets; Claude never types secrets):

  **Live resources (no secrets here):**
  | Where | What | Id / URL |
  |---|---|---|
  | Supabase org *KBS Solutions* (Free) | project `kbs-staging`, Seoul `ap-northeast-2` (free plan = "Asia-Pacific" only), Data API **off** | ref `wmbmlvaivnfokisweiul`; session pooler `postgresql://postgres.wmbmlvaivnfokisweiul:<password>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres` |
  | Supabase Storage | private bucket `kbs-private`, S3 protocol on | endpoint `https://wmbmlvaivnfokisweiul.storage.supabase.co/storage/v1/s3` (in `render.yaml`) |
  | Render "My Workspace" | Blueprint `kbs-staging` from the **public repo URL** (no GitHub app) | API `kbs-solutions-api` `srv-dbb0qte7bikc73baeh2g` → https://kbs-solutions-api.onrender.com ; Key Value `kbs-solutions-redis` `red-dbb0qqe7bikc73bae3n0` (Valkey 8, Singapore) |
  | Vercel team **SKIDOS** (Hobby, user's choice), slug `skidos-60857900` | project `kbs-solutions` (pre-existing, git-linked to `manojjangid1440/kbs-solutions`, one failed deploy) now `rootDirectory=apps/web`, framework nextjs, env `API_URL=https://kbs-solutions-api.onrender.com/api/v1`, `NEXT_PUBLIC_API_URL=/api/v1` | team `team_oVlpZJlovAJPogSzhN9ZW5TQ`, project `prj_jU4jetj7EXlTmUZzD8FYWTqv2bXX`, domain https://kbs-solutions-eta.vercel.app |
  | GitHub repo | variables `STAGING_API_URL`, `STAGING_WEB_URL`; secrets `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | — |

  `DATA_ENCRYPTION_KEY` is now Render `generateValue` (user to copy it into a password manager). Render env entered by the user: `DATABASE_URL`, `OTP_DEV_MASTER_CODE`; `S3_ACCESS_KEY`/`S3_SECRET_KEY` **left empty** (user: "leave them for now") → uploads fail until a Supabase S3 access key is added.
  First deploy of `4af33bf`: build OK, start refused by the staging guard (guessable master code) — the guard works. User changed the code + `WEB_ORIGIN`; the redeploy failed with `P2021 table public.SystemConfig does not exist` — DB reachable, just never migrated (the CD migrate step needed a GitHub DB secret not set yet). Fix: Render's start command now runs `migrate deploy` + seed-if-empty (`SEED_IF_EMPTY=1` skips when any user exists; tested on a fresh local DB and on `kbs_dev`) before the API, so the GitHub DB secret and the CI migrate/seed steps are gone. Needs `BOOTSTRAP_ADMIN_MOBILE` on Render.

  **Still to do:** `BOOTSTRAP_ADMIN_MOBILE` on Render + redeploy; GitHub secrets the user must create (`RENDER_DEPLOY_HOOK_URL` from the API service *Settings → Deploy Hook*, `VERCEL_TOKEN`, `EXPO_TOKEN`); web login; `preview` APK via `mobile-build.yml`; F-819 forced-update test; S3 keys.

