# F-905 performance baseline — for KBS to set thresholds (REQ-24 §24.2)

**These are measurements, not SLAs.** REQ-24 §24.2 requires thresholds approved by KBS; none is asserted by the
harness (`perf/k6`). Re-run on production-like hardware and record the approved numbers in the last table.

## Environment of this baseline (2026-09-23)
- Cloud sandbox: 8 GB RAM, shared vCPUs, PostgreSQL 16 + Redis on the same host, API as a single Node 22 process
  (`node dist/main.js`, `THROTTLE_LIMIT_PER_MIN=100000`), demo data from `apps/api/scripts/demo-seed.mjs`.
- k6 v0.54.0 on the same host (network latency ≈ 0). Numbers are therefore optimistic for latency and pessimistic for
  CPU-bound work (everything shares the box).

## Interactive endpoints (10 VUs, 60 s, `perf/k6/auth.js`, `perf/k6/reads.js`)
| Step | avg | p50 | p95 | p99 | max | Notes |
|---|---|---|---|---|---|---|
| OTP request (`POST /auth/otp/request`) | 21.6 ms | 18.4 ms | 43.8 ms | 69.4 ms | 120 ms | 0 errors, 76 req/s total |
| OTP verify / login (`POST /auth/otp/verify`) | 39.3 ms | 35.5 ms | 79.1 ms | 101 ms | 127 ms | creates session + refresh token |
| Telecaller queue fetch (`GET /calling/queue`) | 19.6 ms | 12.9 ms | 51.8 ms | 80.3 ms | 206 ms | 4 records allocated |
| Card lookup by pincode (`GET /cards/available`) | 15.3 ms | 8.8 ms | 39.4 ms | 104 ms | 249 ms | |
| Manager dashboard refresh (`GET /dashboards/manager`) | 58.7 ms | 50.8 ms | 107 ms | 276 ms | 294 ms | computed on read |
| Admin executive dashboard (`GET /dashboards/admin/executive`) | 108 ms | 99.4 ms | 201 ms | 298 ms | 357 ms | + alerts, launch gates |
| Payout liability dashboard (`GET /dashboards/payouts`) | 68.5 ms | 62.1 ms | 121 ms | 144 ms | 150 ms | |

## MIS import (`perf/k6/mis-apply.js`, synthetic HDFC sheet from `apps/api/scripts/perf-gen-mis.mjs`)
| Rows | File | Upload | Create batch (parse + map) | Preview (match) | Apply | Total |
|---|---|---|---|---|---|---|
| 5 000 | 0.7 MB | 26 ms | < 1 s | 7.7 s | 8.2 s | ≈ 16 s |
| 100 000 | 13.9 MB | 115 ms | ≈ 51 s | 1 m 50 s | 1 m 47 s | 4 m 29 s |

Rows are synthetic (`PERF…` application numbers, no matching leads), so apply measures the full scan with no
bank-status writes; a realistic batch with many matched leads will spend more time in per-lead transactions.

## Findings (acted on / open)
1. **Fixed:** creating a 100 000-row batch failed with *"transaction expired: 5000 ms"* — the row insert transaction
   used Prisma's default interactive timeout. It now scales with the row count (`max(30 s, 5 ms × rows)`).
2. **Open, before production:** preview and apply run synchronously inside the HTTP request (≈ 2 min each at 100 000
   rows). Typical load balancers cut requests at 60 s. Move preview/apply to a BullMQ job with progress polling (the
   row-level `appliedAt` already makes apply resumable) — or cap batch size per upload. Decide before launch.
3. Dashboards are computed on read; at demo volume they are well under 0.5 s. Re-measure with realistic volumes
   (lakhs of calling records) before deciding on materialised views (see F-703 deviation note).
4. Local tooling: stray `nest start --watch` processes from repeated restarts consumed ≈ 5 GB and distorted a first
   run — measure with a single built API process.

## How to run
```bash
pnpm --filter api build && (cd apps/api && THROTTLE_LIMIT_PER_MIN=100000 node dist/main.js)   # non-production API
PERF_DATABASE_URL=postgresql://…/kbs_perf perf/prepare.sh     # clears OTP history (cooldowns) — before each script
cd perf/k6 && k6 run -e VUS=10 -e DURATION=60s auth.js
PERF_DATABASE_URL=… ../prepare.sh && k6 run -e VUS=10 -e DURATION=60s reads.js
node apps/api/scripts/perf-gen-mis.mjs 100000 perf/k6/mis-100k.xlsx && k6 run -e MIS_FILE=./mis-100k.xlsx mis-apply.js
```
Env: `API_URL` (default `http://localhost:4200/api/v1`), `ADMIN_MOBILE`, `MOBILES`, `TELECALLER_MOBILE`,
`MANAGER_MOBILE`, `PINCODE`, `OTP_CODE`. Scripts relax OTP throttles during the run and restore the previous values.

## Thresholds approved by KBS
| Step | p95 threshold | Approved by / date |
|---|---|---|
| _to be filled by KBS_ | | |
