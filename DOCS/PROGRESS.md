# PROGRESS — session memory

> Update this file at the end of every session (see AGENTS.md §3). Newest entry first. Keep "Current state" accurate: a new chat must be able to resume from it alone.

## Current state (as of 2026-09-23, end of session 8)

- **Feature status:** 69 of 71 features **DONE** (`DOCS/features/README.md` and each file's "Progress notes" are the source of truth). Not done:
  - **F-302** Android protected screens — code complete; stays IN_PROGRESS only for the **SEC-02 manual run on a physical Android 12+ device** (checklist in `DOCS/runbooks/02-mobile-security-limits.md`).
  - **F-904** Data retention — **BLOCKED** on KBS durations (REQ-21 §21.5 OPEN). Structure is built and fails closed (`/retention/plan` dry run, legal holds, `/retention/execute` → `CONFIG_MISSING` until `retention.*Days` and `retention.executionEnabled` are set).
- **Latest verification (session 8, cloud sandbox):** workspace typecheck + lint (only the existing TanStack warning); `pnpm test` against baseline-seeded `kbs_base` (shared 39, web 8, mobile 11, api unit 15, db invariants 7, ui-tokens 22); API e2e **131/131 across 34 suites** on `kbs_test`; web Playwright smoke + role routing **54/54** (desktop 1280 + phone 390); REQ-27 QA matrix **58/58** ids named by automated tests (CI ratchet 58).
- **Next steps for a new session (in order):**
  1. On the Mac: push to GitHub, then build the preview APK (`cd apps/mobile && npx eas init && eas build -p android --profile preview`, see `DOCS/runbooks/04-android-release.md`), run the Maestro flows and the SEC-02 checklist → close F-302.
  2. Collect KBS decisions for the open launch gates (Admin → Configuration shows them; `pnpm release:check` lists everything that still fails): retention durations (F-904), office egress CIDRs (F-301), payout designated approver, training thresholds / reactivation window, compliance confirmations and texts, recovery policy (`auth.recoveryEnabled`), audit export policy, perf thresholds.
  3. Engineering follow-up with a recorded decision: move MIS preview/apply into a BullMQ job (100k-row batch takes ~2 min in-request, `DOCS/perf/01-baseline-results.md`).
- **Things to know before touching the code:**
  - BullMQ refuses `:` in custom job ids; `safeJobId()` (jobs.service.ts) maps it to `|`. Any environment that ran the old relay can requeue with the SQL in F-110's notes.
  - Screen protection is route-driven: add a new sensitive mobile screen to `PROTECTED_ROUTES` in `apps/mobile/lib/secure-routes.ts` (unit-tested) — do not wrap screens individually.
  - Status tones/labels live in `@kbs/shared` (`status-tone.ts`) for both apps; visual gallery at web `/dev/components` (production needs `KBS_DEV_GALLERY=1`) and mobile `dev-components` (dev builds).
  - DB invariant tests run against a baseline-seeded DB (`kbs_base`), never by resetting demo data (`kbs_dev`).
- **Sync procedure used from the cloud sandbox:** `git bundle` of new commits → written into the Mac folder as `.sync-<sha>.bundle` → `git fetch <bundle> main:refs/remotes/sync/main && git merge --ff-only` on the Mac; the user pushes to GitHub from the Mac (`origin` = github.com/manoj1440/kbs-solutions).
- **Migration tooling:** offline Prisma via WASM: copy the schema to `old.prisma`, edit, `node packages/db/scripts/wasm-diff.mjs old.prisma` (needs `DATABASE_URL`) → migration SQL; `wasm-migrate.mjs apply` sends each migration as one query (semicolons in comments / `$$` bodies are fine now). On a normal machine the Prisma CLI works as usual.
- **Known environment caveats (not product blockers):** the sandbox cannot reach `binaries.prisma.sh`, `ui.shadcn.com`, `fonts.googleapis.com` (WASM migrations, hand-authored shadcn components, system font stack); `prisma generate` falls back to a stub engine path; no Android SDK / EAS login in the sandbox.
- **Business blockers (unchanged, fail closed):** ★ config keys on Admin → Configuration and the executive dashboard launch-gate alert. See `DOCS/analysis/01-gap-analysis.md`.

## Decisions taken this session (already recorded in ADRs)
Stack: NestJS 11 + Prisma 7 (pg adapter) + PostgreSQL 16 + Redis/BullMQ; Next.js 16 + Tailwind v4 + shadcn/ui; Expo SDK 57 + Expo Router + NativeWind; pnpm + Turborepo. Single-tenant, one Admin, OTP-only. Enum `CallOutcomeKind` (Prisma) ↔ `CallOutcome` (shared) because Postgres forbids an enum and a table with the same name.

## How to run what exists
```
pnpm install && pnpm infra:up
cp apps/api/.env.example apps/api/.env   # set JWT_* (≥32 chars), DATA_ENCRYPTION_KEY (32-byte base64)
cp packages/db/.env.example packages/db/.env && cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate && pnpm db:seed          # single Admin from BOOTSTRAP_ADMIN_MOBILE
pnpm dev                                 # api :4000 (docs /api/docs), web :3000 — OTP prints in the API log; 000000 works in dev
```

## Session log

### 2026-09-23 — Session 8 (remaining features: payouts reconciliation → hardening → shells)
- Worked through every remaining feature with the analyse → `docs(F-xxx): start` → small commits → tests → `docs(F-xxx): done` cycle.
- **Done:** F-606 payout reconciliation and exceptions; F-701 notifications (in-app + Expo push, scrubbed text, dedupe, scope re-check on open); F-702 Manager and F-703 Admin dashboards (one metric engine, `{value, source, dateBasis}`); F-704 audit dashboard (filters, diff, fail-closed CSV export); F-903 DB trigger guard for bank status (INV-01) + `kbs_app` role; F-902 ClamAV scanning with quarantine; F-905 k6 perf baseline; F-901 CI (verify, API e2e, web Playwright, nightly, QA ratchet); F-906 Android release config + `pnpm release:check`; F-104 config editing with reason + history drawer + cross-instance invalidation test; F-105 user admin UI + recovery-gated mobile change; F-110 maintenance scheduler (outbox relay, hold release), job health, worker-mode test; F-301 network policy screens + HTTP-level SEC-01 tests; F-801 access-denied routing for app-only roles + role e2e; F-802 testable token refresher, offline banner; F-803 shared tone vocabulary + galleries.
- **Structure only:** F-904 retention (BLOCKED, fails closed). **Code complete, device check pending:** F-302.
- **Bugs found and fixed:** BullMQ rejected every deterministic outbox job id (`:` separator) — nothing was ever relayed; audit interceptor wrote rows after the response (flaky counts) — now awaited; MIS batch row insert hit the 5 s transaction timeout on large files; web config page overflowed at 390 px; per-screen FLAG_SECURE wrappers could re-allow capture when moving between protected screens; web/mobile payout tones had drifted (VOID).
- Note: F-801's resume skipped its `docs(F-801): start` commit (work and `docs(F-801): done` are in history).

### 2026-09-23 — Session 7 (F-605 Accounts payment recording)
- Deep analysis of REQ-17 §17.6–§17.9 and REQ-18; design decisions (recorded in the F-605 file): append-only `ExternalPayment` with at most one live entry per request and per normalised transfer reference (partial unique indexes); amount mismatch → `EXCEPTION` + request `ON_HOLD` (never partial Paid); proof mandatory per `payouts.proofRequiredForPaid`; corrections proposed by Accounts, approved by Admin (proposer never decides), prior entry kept `SUPERSEDED`; Accounts discrepancy flag before payment; post-payment exceptions surfaced without un-paying or clawback; Advisor sees only a masked receipt.
- Commits: `docs(F-605): start` → `feat(db)` (2 migrations) → `feat(shared)` contracts + tests → `feat(api)` PaymentsService/Controller + request DTO payment trace + proof file access → `test(api)` PAY-05/06/07 + no-money-movement guard → `feat(web)` Accounts workspace + payment panel → `feat(mobile)` receipt → `fix(web)` (browser check found “today” sent as noon IST = future before midday → 400; fixed; shared role shell + payout tables made responsive).
- Browser-checked (Playwright, demo data from `apps/api/scripts/demo-seed.mjs` + one dual-approved request): Accounts OTP login → Awaiting payment → detail → masked payee + logged reveal → record UTR + proof → Paid; Paid queue at 390px with no horizontal overflow; Admin detail with payment trace and the new Payment exceptions nav.
- Work was done in the cloud sandbox from a git bundle of the Mac repo and synced back the same way (see “Sync procedure”).

### 2026-09-23 — Form input validation pass (web + mobile)
- User reported free text could be typed into numeric fields (e.g. `/login` mobile). Client-side validation was ad hoc; authoritative checks remain the Zod contracts in `packages/shared/src/schemas` (enforced on every API request) + `normalize.ts`.
- New typing-time masks in `packages/shared/src/normalize.ts`: `digitsOnly`, `mobileInput` (≤12 digits so 91/0-prefixed input still normalises via `toE164India`), `panInput`, `ifscInput`, `agentCodeInput`, `amountInput`. Covered in `normalize.test.ts`.
- Applied to every numeric/patterned field. Web: `/login` mobile (+ Send OTP disabled until `isValidE164India`), create-telecaller mobile (+ submit gated by `CreateTelecallerBody.safeParse`), compliance suppression mobile, card publication pincode, card joining/annual fee, payout rule hold-days and rate amount. Mobile: auth mobile (+ disabled until valid), manager create-telecaller, lead wizard mobile/PAN/pincode/income, catalogue + card pincode, onboarding account number/IFSC/agent code, advisor profile agent code.
- Free-text fields (reasons, names, search) keep existing `required`/min-length guards; server schema errors still surface as toast/alert text.
- Checks: `pnpm typecheck` 9/9, `pnpm lint` (same TanStack warning), shared 31 + web 5 + mobile 4 tests pass.

### 2026-09-23 — Login page redesign (no-scroll showcase)
- Rebuilt `/login` as a single `h-dvh` no-scroll screen per user request ("no scroll at all, all information at one place, impressive with images/carousel").
- New `apps/web/src/app/(auth)/login/login-showcase.tsx`: auto-rotating 4-slide carousel (5s interval, crossfade, clickable dots) with generated inline SVG artwork — credit cards, MIS matching sheet, payout approval (₹ wallet + dual checks), team ops graph — over a navy panel with glow/dot-grid backdrop and `login-float` animation. Hidden below `lg`; mobile shows compact brand header + form.
- OTP step now uses 6-box digit inputs (auto-advance, backspace-to-previous, paste spread) matching the mobile auth style. `resendAt`/`expiresAt` moved to module-level `otpStep()` because react-hooks/purity flags `Date.now()` inside components.
- Verified: `scrollHeight === innerHeight` at 1280×900 and 390×844 (zero scroll), carousel auto-advance + dot navigation, full OTP round-trip → `/admin/leads`. Web typecheck/lint (0 errors, same TanStack warning)/tests (5)/production build pass. Screenshots: `.playwright-mcp/login-v2-{desktop,otp,mobile,slide3,slide4}.png`.

### 2026-09-23 — Admin table/layout correction (not page scrolling)
- User clarified the UX bug: information and actions extended outside content panels. Leads measured 2209px inside 1046px. Corrected shared table nowrap defaults and badge wrapping, not just scrollbar appearance.
- Leads has a six-column overview keeping separate bank stage/decision/activation and actions visible. More detail exposes references, dates, raw values, provenance and remarks; optional Full table view preserves all 13 sortable columns. Calling activity/records group related fields vertically; responsive rows become labelled cards below 700px container width.
- Reassignment now opens a bounded native dialog with required target/reason, no-target guidance and focus restoration rather than growing an inline table form. No backend, mobile or bank-status changes; shared web components also benefit Manager views.
- Playwright verified both reported pages at 1440/1280/1024/768/390px: default tables fit and actions remain visible. Fifteen other Admin pages checked at 1280px without page/default-table overflow. Verified sorting, expansion, all 13 full-table columns, empty leads search, modal fit and Escape. No reassignment mutation submitted. Screenshots `.playwright-mcp/layout-after-{leads,distribution}-{1280,390}.png`.
- Reusable MCP regression: `apps/web/test/admin-layout-smoke.mjs`; use `browser_run_code_unsafe` with that `filename` on an authenticated Admin page and demo data. Web build/typecheck/lint and 5 unit tests pass; existing TanStack lint warning and previously documented DB fixture failures remain.

### 2026-09-23 — Admin scrolling follow-up
- User reported hidden content/no scrollbar. Reproduced absent scrollbar gutters (native auto-hide); page/sidebar wheel scrolling already worked. Added Admin-only persistent 12px scrollbar styling for page, sidebar, dialogs and tables with stable gutters. No mobile-app/backend changes.
- Playwright asserts 12px page/sidebar/horizontal-table gutters; scroll reaches dashboard footer, sidebar Configuration, rightmost lead-table columns and training Publish button at 1280×720. Mobile drawer scrolls to Configuration at 390×640 without page-width overflow. Screenshot: `.playwright-mcp/admin-visible-scrollbars.png`. Web typecheck/lint/tests rerun; prior workspace DB fixture limitation remains.

### 2026-09-23 — Session 6 (web Admin experience, F-801)
- Replaced launch-gates-only Admin home with an all-time operational business overview: leads/MIS matches, eligible card events, reserved payout value, prominent exceptions/approvals/onboarding/unassigned queues, bank coverage with upload/apply timestamps, distinct payout positions, recent leads with MIS provenance, staffing/allocation counts and expandable launch readiness.
- Totals use complete MIS summaries and payout metadata, never the 5-row recent sample. No invented trends, inferred approvals, global bank freshness or double-counted payout buckets. Partial API failures show unavailable. Dates/amounts retain India formatting.
- New Admin-only shell: grouped navy sidebar, exact active route, responsive navigation dialog, Ctrl/Cmd+K workspace search, account/logout and refresh. Shared web login now split-panel navy/teal branding. Admin-scoped card/table styles extend to existing pages; no mobile, backend, permission or dependency changes.
- Playwright verified OTP login/logout, dashboard numbers (3 leads, 3 matched, 1 eligible event, ₹1,500 reserved, 1 quarantined row), search/no results/Escape/focus restoration, active nested routes, lead-detail and pending-approval links, mobile menu and configuration checklist. Overview has no viewport overflow at 1440/1024/768/390px; leads/MIS/payout/users checked at 390px. Long bank-stage badges wrap; table overflow remains local.
- Checks: `pnpm install && pnpm typecheck` baseline passed; workspace typecheck/lint passed. Web tests 5/5 and production build pass, API unit 13/13. Full `pnpm test` fails `packages/db/test/invariants.test.ts`: expected payoutRule count 0 (demo has 1); expected HDFC profile DRAFT (demo is APPROVED). Existing TanStack React Compiler lint warning and Node 24 vs required 22 engine warning remain. No database reset or assertion weakening.
- Review at `http://localhost:3200/admin`. Screenshots: `.playwright-mcp/admin-overview-desktop.png`, `admin-overview-mobile.png`, `admin-login-desktop.png` (untracked). F-801 remains IN_PROGRESS; F-703 advanced reports/date ranges, notification drawer, dedicated screen refinements and CI browser tests remain follow-ups.

### 2026-09-22 — Session 5 (mobile reskin per design mockup, F-802)
- Applied the S01–S10 design mockup to the advisor app: `(auth)/welcome` is now a 5-slide carousel (brand hero w/ card art, discover, digital selling, card-for-every-need, earnings) with page dots + Get Started/Next/Let's Login CTAs. `(auth)/mobile` + `otp` restyled (brand header, icon field, 6-box OTP w/ countdown + Edit). `(gates)/training` landing restyled (progress bar, module state icons, Continue Learning).
- Advisor IA changed to the mockup's tabs: **Home / Leads / Cards / Earnings / More**. `index` = S09 dashboard (greeting, unread-notification bell, Leads/Applications/Approved/Earnings stat tiles, quick actions, Recent Activity from `/notifications`). New `cards.tsx` = S10 catalogue (card-art thumbs, Apply → lead-new). `pending` removed from tab bar, linked from dashboard.
- Deviation: mockup's password field + Google sign-in on S06 omitted — auth is OTP-only (REQ-12). Card art is drawn with Views (no image assets, no new deps).
- Verified on emulator end to end: carousel → login → OTP → dashboard → catalogue. Earnings tile uses `totals.eligible` (cumulative bucket — do not sum buckets, they overlap).
- Checks: mobile typecheck/lint/test green.

### 2026-09-22 — Session 4 (local e2e run on the Mac, no new features)
- Ran the whole stack locally on the Mac. Ports differ from the runbook because `dsa-partner-portal` (sibling project) holds 3000/4000/8081/5432/6379. Used: API **:4200**, web **:3200**, Metro **:8091**, Postgres `kbs_dev` DB inside the `kbs-test-pg` container (:55432), Redis `kbs-test-redis` (:56379). Minio pull failed (Docker Hub denied `minio/mc`) → `STORAGE_PROVIDER=memory` in `apps/api/.env`.
- The `kbs` database on 55432 is **not ours** (snake_case schema, `schema_migrations` ledger — belongs to dsa-partner-portal). Ours is `kbs_dev` with the PascalCase Prisma schema; `pnpm db:migrate` + `pnpm db:seed` run clean against it.
- New file: `apps/api/scripts/demo-seed.mjs` — re-runnable demo seeder driving the real HTTP API (`node apps/api/scripts/demo-seed.mjs`; resets mutable tables + base seed first, needs docker + kbs-test-pg). Creates: Manager 9876500001, Telecaller 9776500001 (+PASSED training), advisor Asha 9555999001 (full onboarding → admin APPROVE), 2 published HDFC cards + crosswalks, approved ₹1500 'V + ACTIVE' payout rule, 3 leads with bank refs, applied HDFC MIS batch (3 matched, 1 unmatched exception), pincode master + calling list allocated 4/4.
- Verified live: admin web login (OTP cookie flow, `000000` master code) → overview gates, leads table + filters, lead detail (sections A–C + field-level MIS provenance), MIS batches, payout entitlements, allocation page. Mobile in emulator (`kbs-demo` AVD, Expo Go 57.0.9 via `exp://localhost:8091` after `adb reverse tcp:8091 tcp:8091` + `tcp:4200`; **use `EXPO_PUBLIC_API_URL=http://localhost:4200/api/v1` — `10.0.2.2` did not route on this guest**): advisor login → card catalogue → My Leads (MIS badges) → Payouts (entitlement visible) → select + review → submit.
- Found + fixed at runtime: payout request fails closed until `payouts.designatedApproverManagerUserId` is set (launch gate, expected). Set it to the demo manager, then full chain ran: request `KBS-PR-WAJVDEBX` → MANAGER APPROVED → ADMIN APPROVED → state `APPROVED` ("Accounts payment pending", F-605 pending as designed).
- Emulator note: original `kbs` AVD kept ANR-looping (`system_server`, 1536MB RAM, stale state). Created `kbs-demo` by cloning the AVD dir + deleting `userdata*.img` (avdmanager needs a JDK, absent). If the guest ANRs again, keep dismissing "Wait" or recreate the same way.
- Screenshots from the run: `/tmp/emu-final.png` (advisor payouts approved), `admin-leads.png` (repo root, untracked).

### 2026-09-22 — Session 3
- Slice 3: F-401 onboarding, F-402 review, F-405 catalogue browse, F-406 lead drafts/submit, F-407 link + bank reference.
- Slice 4: F-501 MIS profiles, F-502 upload/parse/map, F-504 matching + resolution, F-503 preview, F-505 apply (snapshot/history/outbox), F-506 status DTO + table/row components, F-408 My Leads filters + detail sections + MIS history, F-409 pending actions/follow-ups/remarks, F-410 profile, F-507 integrity dashboard + quarantine.
- API e2e: 79 tests across 19 suites. GitHub remote added; pushes done by the user from the Mac.

### 2026-09-22 — Session 2
- Slice 1: F-106 Agent Codes (API + e2e FOS-02). F-201 Manager screens (web + mobile). F-108 files module (upload/sniff/presign, S3 + memory). F-202 training content admin (API + web editor). F-203 learner flow (API + mobile screens). F-204/F-205 expiry sweep, reactivation, progress views (API + web + mobile). Minimal notifications module (`GET /notifications`).
- Slice 2: F-306 suppression, F-304 pincode master, F-303 customer import wizard, F-305 allocation (auto + manual reassignment + distribution), F-307 calling queue + record detail (mobile), F-403 catalogue, F-404 bank pincode profiles + import + sourceability, F-308 card availability + publications, F-309 calls via telephony port + webhook + recordings, F-310 outcomes/remarks/interest/collision, F-312 official ID (SVG + verify), F-311 WhatsApp sharing, F-313 team ops views.
- API e2e: 56 tests across 13 suites; unit 13. Each feature committed and synced to the Mac after verification (typecheck, lint, tests, headless-browser checks of web pages).

### 2026-09-22 — Session 1 (initial)
- Analysed PRD end-to-end; wrote gap analysis (18 gaps, 11 ambiguities, risk table, better approaches) with dispositions.
- Created DOCS: verbatim requirements (REQ-00…30), 12 ADRs, architecture (system, monorepo, data model, API conventions, security), 71 feature files, conventions, runbooks, AGENTS.md.
- Built F-001…F-006 (tooling, infra, three app scaffolds, `@kbs/shared`, `@kbs/db` with full schema + migrations + seed + INV-01 guard, `@kbs/ui-tokens`).
- Built API core: OTP auth + sessions, RBAC + scoping, audit, SystemConfig + launch gates, users/hierarchy, idempotency, provider ports, jobs/outbox, gates, office-network policy + WFH. 16 e2e + 11 unit tests.
- Built web shell (login, role areas, admin overview/config/users) and mobile shell (login, gates, role tabs, SecureScreen).
- 16 commits, each a small task.
