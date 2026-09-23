# F-901 CI hardening and end-to-end suites

- Group: Hardening · Status: **DONE** · Depends on: F-801, F-802
- PRD refs: REQ-24 §24.5 (critical flows across Android and web; poor connectivity; authorisation failures; long/missing MIS values; varying headings; timezones; simultaneous payouts)

## Scope
Playwright web suites per role; Maestro flows for mobile critical paths; API e2e matrix runs the REQ-27 ids; nightly job with the nine pincode sheets and HDFC fixtures; flaky-test quarantine policy.

## Progress notes
- **CI (`.github/workflows/ci.yml`, blocking):** `verify` (install, generate, typecheck, lint, migrate + seed a baseline DB, `pnpm test` incl. DB invariants, REQ-27 QA-matrix ratchet `--min=56` with the report as artifact); `api-e2e` (disposable DB, all `*.e2e-spec.ts`, `[quarantine]` titles excluded); `web-e2e` (build API + web, start both, Playwright desktop 1280 + phone 390 projects).
- **Nightly (`.github/workflows/nightly.yml`, non-blocking):** full API e2e incl. quarantined tests, run twice with JSON reports (flake detection), QA matrix, k6 login smoke (F-905). The nine bank pincode sheets and HDFC MIS fixtures are exercised by the existing e2e suites (`catalogue.e2e-spec.ts`, `mis-*.e2e-spec.ts`).
- **Web e2e (`apps/web/e2e`, `pnpm --filter web test:e2e`):** 46 checks — every Admin page renders without an error overlay and without page-level horizontal overflow at both widths, notification drawer, signed-out redirect. Local run: `E2E_CHROMIUM=/opt/pw-browsers/chromium E2E_BASE_URL=http://localhost:3200 E2E_DB_URL=… pnpm --filter web test:e2e` → 46 passed.
- **Mobile (`apps/mobile/.maestro`):** Advisor login → Earnings → Notifications, Manager approvals, poor connectivity (airplane mode). Not run in hosted CI (no emulator); required before each APK release (F-906 checklist).
- **QA matrix:** `node scripts/qa-matrix.mjs --write` → `DOCS/qa/qa-matrix.md`; 56/58 REQ-27 ids automated. Not automated: **CALL-03** (calling-context reachability — mobile UI; covered by manual/Maestro run) and **SEC-02** (Android protected screens, F-302).
- **Flaky-test policy:** `DOCS/conventions/01-engineering-conventions.md` (quarantine tag, two-week limit, never for INV-/PAY- tests).
- Root-cause fix made during this work: audit writes are awaited (see F-704), which removed the intermittent audit-count failures.
