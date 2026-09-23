# F-905 Performance acceptance harness

- Group: Hardening · Status: **DONE** · Depends on: F-505, F-307
- PRD refs: REQ-24 §24.2 (measured thresholds approved by KBS; no invented SLA)

## Scope
k6 scripts for OTP/login, queue fetch, card lookup, MIS apply (100k rows), dashboard refresh; results table in DOCS for KBS to approve thresholds.

## Progress notes
- Harness `perf/k6/` (`auth.js`, `reads.js`, `mis-apply.js`, shared `lib.js`), `perf/prepare.sh` (clears OTP history on a non-production DB, refuses URLs containing "prod"), generator `apps/api/scripts/perf-gen-mis.mjs` (synthetic HDFC sheet, exact 36 headers). Each step is a tagged k6 sub-metric; the `max>=0` thresholds only force per-step reporting — **no SLA is asserted** (REQ-24 §24.2).
- API: `THROTTLE_LIMIT_PER_MIN` env (default 300) so perf environments can lift the per-IP budget.
- Baseline + findings: `DOCS/perf/01-baseline-results.md` (interactive p95 40–200 ms at 10 VUs; MIS 100 000 rows ≈ 4.5 min end to end). Found and fixed: 5 s transaction timeout on large batch creation. **Open decision for KBS/engineering before launch:** move MIS preview/apply to a background job (≈ 2 min synchronous requests at 100k rows exceed typical 60 s proxy timeouts).
- Nightly k6 login smoke in `.github/workflows/nightly.yml` (F-901), report only.
