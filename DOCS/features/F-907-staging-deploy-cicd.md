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
Supabase (DB + storage, ap-south-1) · Render (API + Key Value, Singapore, `render.yaml`, deploy hook only) · Vercel Hobby (web, sin1, git deploys off) · EAS free (`preview` profile = staging API, channel `preview`) · GitHub Actions: CI → **Deploy staging** job (migrate → Render, wait for `/health.commit` = SHA → Vercel prebuilt → EAS OTA when mobile paths changed), manual seed input, manual APK build workflow, keep-warm schedule. Staging uses the Supabase owner role (runbook 03 stays the production procedure).

## 3. Phases
| Phase | Scope | Status |
|---|---|---|
| P1 | Fix red CI (e2e args, seed order) | DONE |
| P2 | API `staging` mode + `/health.commit`; web same-origin proxy; `render.yaml`, `vercel.json`, eas `preview` URL | DONE |
| P3 | Workflows: deploy job in `ci.yml`, `keep-warm.yml`, `mobile-build.yml`; runbook 05 | DONE |
| P4 | User creates accounts + secrets (runbook 05 §1–5); first deploy with seed; verify web login, APK on staging, F-819 forced update on the S24 | |

## 4. Acceptance
- [ ] CI green on `main` (all three jobs).
- [ ] A push to `main` deploys API + web automatically; `/health.commit` equals the pushed SHA.
- [ ] Web login on the Vercel URL with the Admin mobile + master code.
- [ ] A mobile-only change reaches the S24 as an OTA update without a new APK.
- [ ] F-819: `app.android.minVersion` above the installed version blocks the staging app.

## Progress notes
- 2026-10-19: P1–P3. Local rehearsal: API built and run with `NODE_ENV=staging` (Swagger 404, `/health.commit` from `RENDER_GIT_COMMIT`, master code `000000` refused at boot), web production build with `NEXT_PUBLIC_API_URL=/api/v1` → health through the rewrite and a full browser login to `/admin` (cookies on the web origin, server-rendered home). Checks: api unit 18/18 (new `env.spec.ts`), api + web typecheck/lint, workflow YAML parses.
