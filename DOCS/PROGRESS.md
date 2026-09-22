# PROGRESS — session memory

> Update this file at the end of every session (see AGENTS.md §3). Newest entry first. Keep "Current state" accurate: a new chat must be able to resume from it alone.

## Current state (as of 2026-09-22, end of session 3)

- **Phase:** Slices 1–4 **done** (Telecaller lifecycle; calling desk; Advisor F-401/402/405/406/407; MIS F-501–F-507 + F-408/409/410). Next: **slice 5 payouts** (F-601 rules → F-602 entitlement evaluation (consume `mis.lead.changed` / `payouts.review` outbox events) → F-603 ledger + request/reservation → F-604 dual approval → F-605 Accounts payment → F-606 reconciliation), then F-701 notifications (outbox fan-out/push), F-702/F-703/F-704 dashboards, hardening F-9xx.
- **Green checks:** `pnpm turbo run typecheck lint test` → 21/21 tasks (shared vitest 25, web vitest 1 = VIEW-02 grep guard, api unit 13); API e2e **79/79** across 19 suites; web pages browser-checked after every feature (MIS batch preview/apply/resolve, leads table + filters + detail, lead ops, MIS integrity); mobile typechecks/lints.
- **Feature status:** 47 DONE — see `DOCS/features/README.md` (statuses + "Progress notes" per file are the source of truth).
- **API surface added in slices 3–4 (all under `/api/v1`):** `/onboarding/me/*`, `/onboarding/review[/:userId]`, `/me/profile`, `/me/agent-code`, `/cards/browse`, `/leads/declarations`, `/leads/drafts…`, `/leads?…` (F-408 filters) + `/leads/filters`, `/leads/:id` (F-506 DTO + sections A/B/C), `/leads/:id/{link/share,link/open,bank-reference,mis-history,follow-ups,remarks}`, `/follow-ups/:id/done`, `/pending-actions`, `/mis/profiles…` (+`/known-values`), `/mis/batches…` (+`/preview`, `/apply`, `/rows`, `/reject`), `/mis/rows/:id/resolve`, `/dashboards/mis-integrity[/quarantine]`.
- **Web pages added:** Admin `/admin/onboarding[/userId]`, `/admin/leads[/id]`, `/admin/mis`, `/admin/mis/profiles/[id]`, `/admin/mis/batches/[id]`, `/admin/mis/integrity`; Manager `/manager/leads[/id]`, `/manager/pending-actions`. Mobile Advisor: onboarding wizard, home/card browse, lead wizard, My Leads (filters), lead detail (sections + MIS history + tasks/remarks), Pending, Profile.
- **Key invariants now enforced in code/tests:** INV-01 (`withMisApplyContext` guard; MIS-07), INV-02 display rule (`bankValueDisplay`, F-506 `buildLeadStatusRow` snapshot tests), exact-reference matching only (MIS-09), no timeline component (VIEW-02 grep test), no MIS-derived tasks without `mis.actionableRules` (VIEW-03), Advisor profile DTO strict schema (F-410).
- **Decisions this session (candidates for ADRs):** MIS preview/apply run synchronously in-request (row-level `appliedAt` makes re-apply resumable; move to BullMQ job when batches grow); `payouts.review` and `mis.lead.changed` are written to `OutboxEvent` now and consumed in slice 5/F-701; pending actions are computed on read (no materialised task table for MIS rules); `lastMatchedAt` sorts are ordered in memory so never-matched leads always sort last.
- **Next step for a new session (in order):** F-601 (rate tables per bank/card, versioned; config `payout.designatedApprover…`), F-602 (evaluate entitlements from applied snapshots — activation values distinct, `TXN ACTIVE - Rs 100` ≠ `V + ACTIVE`; consume outbox), F-603, F-604, F-605, F-606; wire lead detail section D and PayoutStateBadge. Then F-701.
- **Sync procedure used from the cloud sandbox:** `git bundle` of new commits → written into the Mac folder as `.sync-<sha>.bundle` → `git fetch <bundle> main:refs/remotes/sync/main && git merge --ff-only` on the Mac; the user pushes to GitHub from the Mac (`origin` = github.com/manoj1440/kbs-solutions). On a normal machine just push/pull.
- **Known environment caveats (not product blockers):**
  - The build sandbox could not reach `binaries.prisma.sh`, `ui.shadcn.com`, `fonts.googleapis.com`. Consequences: migrations were generated with the Prisma **WASM** engine (`packages/db/scripts/wasm-migrate.mjs`), which yields the same SQL as the CLI; shadcn components were hand-authored (identical to CLI output, `components.json` is ready for `npx shadcn add`); web uses a system font stack. On a normal machine `pnpm db:migrate:dev` and `npx shadcn add` work as usual.
  - `prisma generate` wrapper (`packages/db/scripts/generate.mjs`) falls back to a stub engine path when the download fails — harmless, generation never runs the engine.
  - Dev and e2e currently share the local Postgres in the sandbox; e2e `resetDatabase` truncates it, so re-seed demo data (see scratch `seed-leads.mjs` pattern) before browser checks.
- **Business blockers (unchanged, fail closed):** ★ config keys listed on the Admin overview page (payout designated approver, training thresholds/reactivation window, compliance confirmations incl. `compliance.callingListConsentConfirmedByCompliance`, `compliance.recordingDisclosureText`, `compliance.whatsappConsentPolicy`, retention, declarations). See `DOCS/analysis/01-gap-analysis.md`.

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
