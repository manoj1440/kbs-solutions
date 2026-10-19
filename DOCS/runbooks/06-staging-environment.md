# Staging environment map (F-907)

What is deployed where, every environment variable, and where each **secret** is kept. Secret *values* are never in
this repository (it is public) — only the place that holds them. Setup steps: runbook 05. Last verified 2026-10-19.

## URLs
| What | URL |
|---|---|
| Web admin (Vercel) | https://kbs-solutions-eta.vercel.app |
| API (Render) | https://kbs-solutions-api.onrender.com/api/v1 — health: `/api/v1/health` (shows the deployed `commit`) |
| Web → API proxy | https://kbs-solutions-eta.vercel.app/api/v1/* (same API, first-party cookies) |
| App version policy (public) | https://kbs-solutions-api.onrender.com/api/v1/app/version |
| Staging APK 0.2.0 (current) | https://expo.dev/artifacts/eas/q028YCyeSEqU4T7FfSL7lbe1Yw6m2ZAQfEPMqhBCNDQ.apk (EAS build `2b57f798`) |
| Staging APK 0.1.0 (blocked by policy) | https://expo.dev/artifacts/eas/udr4ltWS4rmqWqjdDGfSzD5W7iUJiPMUP0-0VnXbc3U.apk (EAS build `4295d3b1`) |
| CI/CD runs | https://github.com/manoj1440/kbs-solutions/actions |

## Where each piece runs
| Piece | Provider / account | Resource | Ids |
|---|---|---|---|
| Postgres | Supabase, org **KBS Solutions** (Free) | project `kbs-staging`, Seoul `ap-northeast-2`, Data API off | ref `wmbmlvaivnfokisweiul` |
| File storage | Supabase Storage (same project) | private bucket `kbs-private`, S3 protocol on | endpoint `https://wmbmlvaivnfokisweiul.storage.supabase.co/storage/v1/s3` |
| API | Render "My Workspace" (Free), Singapore | web service `kbs-solutions-api`, Blueprint `kbs-staging` from `render.yaml` (public repo URL, no GitHub app) | `srv-dbb0qte7bikc73baeh2g`, blueprint `exs-dbb02urbc2fs73d1ftog` |
| Redis | Render Key Value (Free, Valkey 8), Singapore | `kbs-solutions-redis` (internal only, `noeviction`) | `red-dbb0qqe7bikc73bae3n0` |
| Web | Vercel team **SKIDOS** (Hobby, slug `skidos-60857900`) | project `kbs-solutions`, root `apps/web`, region sin1, git deploys off (`apps/web/vercel.json`) | team `team_oVlpZJlovAJPogSzhN9ZW5TQ`, project `prj_jU4jetj7EXlTmUZzD8FYWTqv2bXX` |
| Mobile builds + OTA | Expo EAS, account `manojskidoss-team`, project `kbs` | profile/channel `preview` = staging | project `d52957fe-d8b8-497b-ac7c-52ca691f43be` |
| CI/CD | GitHub Actions on `manoj1440/kbs-solutions` | `ci.yml` (checks + Deploy staging), `keep-warm.yml`, `mobile-build.yml`, `nightly.yml` | — |

## How a deploy happens
Push to `main` → `ci.yml`: typecheck · lint · unit · DB invariants, API e2e, web Playwright → **Deploy staging** (only if all green):
1. `POST RENDER_DEPLOY_HOOK_URL&ref=<sha>` → Render builds (`pnpm install`, `db:generate`, `turbo run build --filter=api`) and starts `prisma migrate deploy` → seed **only if the DB has no users** → `node apps/api/dist/main.js`; the job waits until `/health.commit` = the pushed SHA.
2. `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` (uses Vercel project env below).
3. If `apps/mobile`, `packages/shared`, `packages/ui-tokens` or `pnpm-lock.yaml` changed: `eas update --channel preview --platform android` with `EXPO_PUBLIC_API_URL` = `STAGING_API_URL`.

Native app changes: bump `version` in `apps/mobile/app.json`, run **Mobile build (APK)** (`mobile-build.yml`, profile `preview`), then set `app.android.minVersion` / `latestVersion` / `downloadUrl` in Admin → Configuration → *Mobile app updates* (runbook 04, F-819).

## Environment variables

### API — Render service `kbs-solutions-api` (source of truth: `render.yaml`)
| Key | Value | Secret? / where |
|---|---|---|
| `NODE_VERSION` | `22` | — |
| `NODE_ENV` | `staging` | — |
| `API_PORT` | `10000` | — |
| `TZ` | `UTC` | — |
| `LOG_LEVEL` | `info` | — |
| `JOBS_INLINE` | `1` | — |
| `JOBS_DISPATCH` | `local` | — |
| `TRUST_PROXY_HOPS` | `1` | — |
| `BOOTSTRAP_ADMIN_MOBILE` | first Admin's mobile | personal data — Render dashboard only |
| `BOOTSTRAP_ADMIN_NAME` | `KBS Admin` | — |
| `WEB_ORIGIN` | `https://kbs-solutions-eta.vercel.app` | — (set in Render dashboard) |
| `API_PUBLIC_URL` | `https://kbs-solutions-api.onrender.com` | — (set in Render dashboard) |
| `DATABASE_URL` | `postgresql://postgres.wmbmlvaivnfokisweiul:<password>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres` | **secret** (password) — Render dashboard; password in the owner's password manager / Supabase *Reset database password* |
| `REDIS_URL` | from `kbs-solutions-redis` | internal, set by Render |
| `JWT_ACCESS_SECRET` | generated | **secret** — Render-generated |
| `JWT_REFRESH_SECRET` | generated | **secret** — Render-generated |
| `OTP_PEPPER` | generated | **secret** — Render-generated |
| `DATA_ENCRYPTION_KEY` | generated (base64, 32 bytes) | **secret** — Render-generated; **copy to a password manager** (losing it = encrypted PAN/bank fields unreadable) |
| `OTP_PROVIDER` | `console` | — |
| `OTP_DEV_MASTER_CODE` | 6 digits | **secret** — Render dashboard; the staging login code, shared only with testers |
| `PUSH_PROVIDER` | `expo` | — |
| `SCAN_PROVIDER` | `noop` | — |
| `STORAGE_PROVIDER` | `s3` | — |
| `S3_ENDPOINT` | `https://wmbmlvaivnfokisweiul.storage.supabase.co/storage/v1/s3` | — |
| `S3_REGION` | `ap-northeast-2` | — |
| `S3_BUCKET` | `kbs-private` | — |
| `S3_ACCESS_KEY` | **not set yet** | **secret** — create in Supabase → Storage → S3 → *New access key*; uploads fail until set |
| `S3_SECRET_KEY` | **not set yet** | **secret** — same |
| `S3_FORCE_PATH_STYLE` | `1` | — |
| `RENDER_GIT_COMMIT` | set by Render | — (reported by `/health`) |

### Web — Vercel project `kbs-solutions` (Production + Preview)
| Key | Value | Notes |
|---|---|---|
| `API_URL` | `https://kbs-solutions-api.onrender.com/api/v1` | server-side fetches + target of the `/api/v1` rewrite; must stay in `turbo.json` `tasks.build.env` |
| `NEXT_PUBLIC_API_URL` | `/api/v1` | relative → browser calls go through the web domain |

### Mobile — EAS (`apps/mobile/eas.json`)
| Profile | Channel | `EXPO_PUBLIC_API_URL` | `APP_VARIANT` |
|---|---|---|---|
| `preview` (staging APK) | `preview` | `https://kbs-solutions-api.onrender.com/api/v1` | `preview` |
| `device` (Mac on LAN) | `device` | `http://192.168.31.215:4000/api/v1` | `device` |
| `production` | `production` | `https://api.example.invalid/api/v1` (placeholder) | `production` |

### GitHub Actions (repo *Settings → Secrets and variables → Actions*)
| Name | Kind | Value / where |
|---|---|---|
| `STAGING_API_URL` | variable | `https://kbs-solutions-api.onrender.com/api/v1` |
| `STAGING_WEB_URL` | variable | `https://kbs-solutions-eta.vercel.app` |
| `VERCEL_ORG_ID` | secret | `team_oVlpZJlovAJPogSzhN9ZW5TQ` (an id, not a credential) |
| `VERCEL_PROJECT_ID` | secret | `prj_jU4jetj7EXlTmUZzD8FYWTqv2bXX` (an id) |
| `VERCEL_TOKEN` | secret | Vercel → Account → Tokens (scope SKIDOS) |
| `RENDER_DEPLOY_HOOK_URL` | secret | Render → `kbs-solutions-api` → Settings → Deploy Hook |
| `EXPO_TOKEN` | secret | expo.dev → Account → Access tokens |

### Admin configuration on staging (SystemConfig, set in the web admin)
| Key | Value |
|---|---|
| `app.android.minVersion` | `0.2.0` (0.1.0 installs are blocked) |
| `app.android.downloadUrl` | the 0.2.0 APK link above |
| `app.android.latestVersion` | unset |

## Rotating a secret
Change it at the place listed above, then redeploy: Render → *Manual Deploy* (API values), or re-run **CI** on `main` (GitHub/Vercel values). Rotating `JWT_*` signs everyone out; never rotate `DATA_ENCRYPTION_KEY` without a re-encryption plan.
