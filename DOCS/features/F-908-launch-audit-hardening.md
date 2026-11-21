# F-908 Launch audit: security, polish, DPDP

- Group: Hardening · Status: **DONE** (legal facts, notice wording and retention periods are owner follow-ups) · Depends on: F-904, F-907
- PRD refs: REQ-21 (privacy and compliance), REQ-24, REQ-28 §28.2
- Origin: user request (2026-11-21, session 29): "do a deep analysis and implement, then commit and push after verify" (webapp-launch-audit).

## 1. Analysis (three read-only audits, 2026-11-21)

**Security (API).** Strong base: every route has a permission or is explicitly `@Public`. Cross-user access checks were confirmed on leads, payouts, files, calls, users and bank details. Refresh-token rotation detects reuse. Payment recording takes a row lock. PAN and bank fields use AES-GCM. Audit logging is complete. Gaps:

| # | Finding | Severity |
|---|---|---|
| S1 | OTP verify is check-then-act (`auth.service.ts:86-98`). Parallel guesses get past the 5-attempt lock. A code can be consumed twice. | High |
| S2 | Payout `cancel()` and `decide()` (`payout-requests.service.ts:336-428`) take no lock and do no state check. A cancel racing with a payment can overwrite PAID and release PAID entitlements, which can lead to a double payment. | High |
| S3 | The throttler tracks `req.ip` with no `trust proxy`, and its store is in memory. All web traffic arrives from Vercel, so everyone shares one bucket. | High |
| S4 | OTP send cooldown is count-then-create. A parallel burst sends many SMS. | Medium |
| S5 | Upload buffer is 200 MB in memory (`files.controller.ts:18`), checked before the 25 MB rule. This is a memory DoS on the 512 MB instance. | Medium |
| S6 | The Exotel webhook `?token=` is written to request logs. The recording-fetch host check `endsWith('exotel.com')` also matches `evilexotel.com`. | Medium |
| S7 | Web has no security headers: no frame protection, HSTS, Referrer-Policy or nosniff. | Medium |
| S8 | In production, boot accepts the default `OTP_PEPPER`, mock KYC/PAN/telephony, memory storage and the noop scanner. | Medium |
| S9 | The idempotency lock treats a Redis error as success, never releases the lock on error, and has a 15 s TTL. | Medium |
| S10 | Lower-severity items: an open WhatsApp delivery webhook while the provider is `handoff`, a chatty public `/health`, raw exception messages in logs, and no unzip size cap on Excel files. | Low |

**Polish (web).** The API client throws on non-2xx, so success messages are honest. Gaps:

| # | Finding |
|---|---|
| P1 | No `robots`, no `noindex` and no `X-Robots-Tag` anywhere. The public `/verify/[ref]` page shows a name and can be indexed. |
| P2 | 38 of 67 pages have no title, and there is no title template. |
| P3 | The favicon is the stock Next.js icon. There is no `icon` or `apple-icon`. `public/` holds unused boilerplate SVGs. |
| P4 | No `global-error.tsx`. `/verify/[ref]` does not check `res.ok`. |
| P5 | Errors are swallowed in four places: compliance Lift, mark-all-read, the calling-list wizard review, and the onboarding review callout tone. |
| P6 | Double submits are possible: onboarding review, wizard accept/exclude, Suppress, mark-all-read. |
| P7 | The login page is clipped on short phones (`h-dvh overflow-hidden`). |
| P8 | Small items: drawer `aria-haspopup` and 44 px targets, Escape on the account menu, `mailto:` links, `+91` on `tel:`, reduced motion on status pages, unused dependencies, `JSON.parse` of an HTML error page. |

**DPDP.** Encryption, audit, the sensitive-access log and the calling-list consent gate are in place. There are no trackers, so no cookie banner is needed. Gaps:

| # | Finding |
|---|---|
| D1 | No privacy notice anywhere (web or app). Consent is collected against the version label `v1-draft`. |
| D2 | Advisor consent is one bundled "I consent and accept the terms" button. It stores the raw IP and no user agent. |
| D3 | No grievance officer or grievance channel. |
| D4 | No way to request access, correction or erasure, and no data download. Google Play also requires an in-app and a web account-deletion path. |
| D5 | No breach / incident runbook, and no data inventory or processor list. Staging is hosted in Seoul and Singapore. |
| D6 | Follow-up push notifications carry the customer's name through Expo/FCM. |
| D7 | Expired `OtpChallenge`, `LeadDraft` (encrypted PAN) and `IdempotencyRecord` rows are never purged. |

## 2. Owner decisions (2026-11-21)

1. **Data rights: request queue.** Signed-in users on the app and the web can file ACCESS / CORRECTION / ERASURE / GRIEVANCE requests and download their own data. The Admin has a queue to track and close requests. Staff carry out erasure by hand, because retention periods (F-904) are still blocked. There is no automatic anonymiser yet.
2. **Legal facts are left blank.** `packages/shared/src/legal/company.ts` holds them all as `null`. The UI shows "To be confirmed by KBS", and the release check lists every null as a blocker.
3. **Push text uses the lead reference.** Follow-up reminders say "lead KBS-L-…". The customer's name is shown only inside the app.

## 3. Workstreams and file ownership

No two workstreams edit the same file. The coordinator keeps `packages/shared/src/legal/company.ts`, `packages/shared/src/index.ts`, `apps/api/src/app.module.ts` (module registration only, after A) and the admin nav in `apps/web/src/components/**/workspace-shell.tsx` (nav entries only, after B). Any other change these files need is reported as an integration step.

### A. Security (API)
Owns:
- `apps/api/src/modules/auth/**`
- `apps/api/src/modules/payouts/payout-requests.service.ts`
- `apps/api/src/bootstrap.ts`
- `apps/api/src/app.module.ts` (throttler and logger config)
- `apps/api/src/common/**` (guards, interceptors, errors, import, client-ip)
- `apps/api/src/config/env.ts` and `env.spec.ts`
- `apps/api/src/modules/files/files.controller.ts`
- `apps/api/src/providers/**`
- `apps/api/src/modules/sharing/sharing.controller.ts`
- `apps/api/src/modules/health/**`
- New e2e specs `apps/api/test/security-*.e2e-spec.ts` and `apps/api/test/payout-race*.e2e-spec.ts`

Items: S1–S6, S8–S10. `/health` must keep `status` and `commit`, because the CI deploy job waits on `commit`.

### B. Polish (web)
Owns:
- `apps/web/src/app/layout.tsx`, `robots.ts`, icons, `global-error.tsx`, `not-found.tsx`, `error.tsx`
- `apps/web/next.config.ts` (security headers S7 and `X-Robots-Tag`)
- `apps/web/public/**`, `apps/web/package.json`
- Every `apps/web/src/app/**/page.tsx` for metadata only, except the `(legal)` group and `admin/privacy-requests`
- The components named in P4–P8: `verify/[ref]`, the `(auth)/login` page, workspace-shell, notification-bell/centre, compliance actions, the calling-list wizard, onboarding review-actions, account-page, `globals.css`
- `packages/shared/src/client/index.ts`
- Web vitest tests

Items: P1–P8, S7. Also links "Privacy notice" (`/privacy`) and "Grievances" (`/grievance`) under the login form.

### C. Legal content and docs
Owns:
- `packages/shared/src/legal/privacy-notice.ts` (the wording)
- `apps/web/src/app/(legal)/**` (`/privacy`, `/terms`, `/grievance`; public, noindex)
- `packages/shared/src/config-keys.ts` (`onboarding.privacyNoticeVersion` and `support.contact` become required-before-prod)
- `scripts/release-check.mjs` (legal-facts lines)
- `apps/api/src/modules/maintenance/**` (D6 push text, D7 nightly purge)
- `DOCS/runbooks/10-incident-response.md`
- `DOCS/architecture/06-data-inventory.md`
- The privacy section of `DOCS/architecture/05-security-and-privacy.md`

### D. Consent and data rights
Owns:
- `packages/db/prisma/schema.prisma` and new migrations (`DataRequest` model)
- `packages/shared/src/schemas/**` (new privacy schemas)
- `packages/shared/src/permissions.ts`, `enums.ts` and `audit-actions.ts`
- New `apps/api/src/modules/privacy/**` and its e2e spec
- `apps/api/src/modules/onboarding/onboarding.service.ts` (hashed IP and user agent)
- `apps/web/src/app/(admin)/admin/privacy-requests/**`
- `apps/web/src/app/(admin)/admin/account/**` (own requests)
- The account pages for the Manager and Accounts roles, if they exist
- `apps/mobile/**`: the privacy screen that renders `PRIVACY_NOTICE`, unbundled onboarding consent, a notice link on the mobile-number screen, and "Your data" on the three profile screens

## 4. Owner follow-ups (not done in code)

- Fill `COMPANY` in `packages/shared/src/legal/company.ts`: legal name, entity type, CIN, GSTIN, address, privacy email, Grievance Officer, storage region.
- Approve the final privacy notice and terms wording, then bump the version (`onboarding.privacyNoticeVersion` and `PRIVACY_NOTICE.version` together).
- Retention periods (F-904), `leads.declarations` customer texts, recording disclosure text.
- Production hosting in India (Supabase Pro, Mumbai), or name the foreign regions in the notice. Data processing agreements with Cashfree, Exotel, MSG91, Supabase, Render, Vercel and Expo.
- Incident-response owners and the CERT-In point of contact.

## 5. Verification plan
`pnpm typecheck && pnpm lint`, unit and invariant tests (`kbs_base`), API e2e (`kbs_test`, baseline 189/189), web build, then a browser pass on the built web app against the local DB: titles, 404 status, robots, headers, login at 375 px, `/privacy`. After that, an independent regression review of the auth and payout paths. Push `main`, then confirm that the CI deploy reached the pushed commit (`/health.commit`) and the Vercel deployment.

## 6. Result (session 29)

All items S1–S10, P1–P8 and D1–D7 are implemented. The exceptions are listed in the deviations below.

**Behaviour changes to know before deploying**
- **OTP:** a guess is reserved before the code is compared, and a code is consumed only once. A parallel duplicate send gets `AUTH_OTP_RESEND_TOO_SOON` (with `retryAfterSec`) through a Postgres advisory lock taken per mobile.
- **Payouts:** `cancel()` and `decide()` lock the request row, using the same lock and order as payments, and re-check state inside the lock. Cancelling a PAID request is refused. Approving a CANCELLED request is refused. Tests PAY-20 to PAY-24.
- **Throttling:** counters are kept in Redis, with in-memory as the fallback and in tests. Signed-in requests are counted per user, anonymous requests per client IP.
- **Uploads:** only `files.maxUploadMb` (25 MB) is buffered. The 200 MB limit applies only to `TRAINING_VIDEO` uploaded by an Admin.
- **WhatsApp:** `POST /webhooks/whatsapp/delivery` returns 404 unless the provider is the business API and `WHATSAPP_WEBHOOK_TOKEN` is set.
- **Health:** public `/health` returns only `{status, db, redis, commit}`. Queue and outbox details are on `GET /ops/jobs` (Admin).
- **Production boot:** `NODE_ENV=production` refuses to start with the default `OTP_PEPPER`, mock KYC/PAN/telephony, memory storage or the noop scanner. Staging is unaffected.
- **Logging:** request logs redact secret-looking query values. In staging and production, unexpected errors are logged without their message text.
- **Web headers:** the web app sends `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HSTS, Referrer-Policy, nosniff, Permissions-Policy and `X-Robots-Tag: noindex`, plus `robots.txt` with `Disallow: /`. The full CSP is report-only for now.
- **New public pages:** `/privacy`, `/terms` and `/grievance`. The app has a privacy screen and a "Your data" screen. The web account page has a "Your data" panel. The admin has `/admin/privacy-requests`.
- **Onboarding consent:** the app now shows two separate checkboxes. `PUT /onboarding/me/consent` accepts an optional `scopes`; old app versions keep working. The stored IP is now a salted hash, saved together with the user agent.
- **New table:** migration `20261121100000_data_requests` (additive).
- **Nightly purge** (03:00 IST): expired OTP challenges and lead drafts, idempotency records older than 7 days, and sessions and tokens ended more than 30 days ago.
- **Release check:** `pnpm release:check` now fails while any `COMPANY` fact is null or the notice version contains "draft".

**Deviations after the regression review**
- **Idempotency when Redis is down:** if the Redis lock can't be taken, the request runs without it and a warning is logged. The first version refused with 503. Duplicates are still refused by database guards: row locks, the one-live-payment and one-active-item unique indexes, and the stored replay record.
- **Workbook size guard:** for ZIP64 or unreadable zip directories it falls back to the compressed-size cap. The first version refused these files, which would have rejected some bank exports.
- **Real visitor IP behind the web proxy: not wired.** Running Next `proxy` on `/api/v1` would buffer every request body with a 10 MB cap and break uploads. The API already supports `TRUSTED_PROXY_SECRET` and the `x-kbs-proxy-secret` header (`common/client-ip.ts`). Follow-up: inject that header at the edge with a Vercel-level rewrite or header, or move the API behind the same domain. Until then, anonymous web calls share the proxy IP, as they did before this change.

**Verification:** typecheck, lint and unit tests pass (api 98, shared 61+, mobile 20, web 24, db 7). API e2e passes 212/212 (baseline 189 plus 23 new). Web production build passes. A browser pass on the built app (`next start` on :3100) confirmed headers, `robots.txt`, a 404 status for unknown paths, titles in the form "X · KBS Solutions", and the login and privacy pages at 375 px with no horizontal overflow. An independent regression review of OTP, throttling, payouts, idempotency, uploads, consent, the privacy module, env, health and headers found no breakages; its two behaviour notes are handled above.
