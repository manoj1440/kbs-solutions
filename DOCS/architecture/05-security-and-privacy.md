# Security and privacy controls

Maps REQ-09, REQ-21, REQ-24 to concrete controls. Every row is either **CORE** (built in the foundation) or names the feature that adds it.

| Control | Status | Detail |
|---|---|---|
| OTP-only auth, no password columns | CORE | `OtpChallenge` hashed codes; `User` has no password. |
| OTP rate limits | CORE | `SystemConfig auth.otp.*`; per-mobile and per-IP; lockout after 5 wrong tries. |
| Access/refresh JWT with rotation + reuse detection | CORE | Family revoke on reuse. Atomic claim + 30 s benign-retry window for lost/concurrent refreshes (ADR-015). |
| Server-side RBAC + ownership | CORE | `RolesGuard` + scoped query builders; RBAC-01/02 tests. |
| Telecaller office-network policy | F-301 | Egress IP allowlist, WFH exceptions, fail closed. |
| Android FLAG_SECURE on protected screens | F-302 | `expo-screen-capture` `preventScreenCaptureAsync` in protected route groups; document residual risk. |
| PAN encryption at rest | CORE | AES-256-GCM via `CryptoService`; only `panLast4` in plaintext. |
| Aadhaar: number never stored | CORE (schema) | Only provider result/reference; F-401 implements flow behind `KycProvider`. |
| Bank account encryption + masking | CORE | Same `CryptoService`. |
| Sensitive access logging | CORE | `SensitiveAccessLog` written by `?reveal` paths and file downloads. |
| Redacted structured logs | CORE | pino redaction paths. |
| Audit log for all mutations | CORE | `AuditInterceptor` + explicit service writes. |
| Idempotency on side-effecting POSTs | CORE | `Idempotency-Key`, 24 h. |
| File type validation, size limits, scan status gate | CORE (files module) | Scan adapter no-op in dev, marked `SKIPPED`. |
| Presigned, expiring download URLs | CORE | 5 min. |
| Helmet, CORS allowlist, cookie flags | CORE | |
| Secrets via env only; `.env` ignored | CORE | |
| Data retention / deletion authority | BLOCKED (REQ-21 §21.5 OPEN) | F-904 structure built fail-closed: `/retention/plan` dry run, legal holds, `/retention/execute` refuses (`CONFIG_MISSING`) until `retention.*Days` are set and `retention.executionEnabled` is on. Files purged (row kept), calling records restricted, never deleted; MIS/payout/audit/suppression data out of scope. |
| Purge of expired operational records | F-908 | Nightly `privacy.purgeOperational` (03:00 IST): expired OTP challenges (+1 day), expired lead drafts (encrypted PAN), idempotency records older than 7 days, sessions/refresh tokens 30 days after revocation or expiry. Not F-904 business data; audited per run (`maintenance.purge`, counts only). |
| Push text without customer data | F-908 | Follow-up reminders name a lead by `KBS-L-…` and a calling record not at all; names stay inside the app (push leaves India via Expo/FCM). |
| Malware scanning provider | F-902 | ClamAV adapter. |
| DB-level trigger protecting bank-status columns | F-903 | |

## Privacy (DPDP Act 2023) — F-908

- **Notice:** one text for web and app, `packages/shared/src/legal/privacy-notice.ts` (`PRIVACY_NOTICE`), shown at `/privacy` and on the app's privacy screen. Version `v1-draft` until KBS approves the wording; bump it together with `onboarding.privacyNoticeVersion`. Terms at `/terms`, Grievance Officer and account deletion at `/grievance` (public, `noindex`).
- **Legal facts:** `packages/shared/src/legal/company.ts` (`COMPANY`). Unknown values render "To be confirmed by KBS"; `pnpm release:check` fails while any is missing or the notice version is a draft. `onboarding.privacyNoticeVersion` and `support.contact` are launch gates.
- **Data rights:** request queue (`DataRequest`, API `/privacy/requests`, Admin `/admin/privacy-requests`): access, correction, erasure and grievance requests from the app ("Your data" on Profile) and the web account page. Erasure is carried out by staff by hand while F-904 retention periods are open.
- **Data inventory and processors:** `DOCS/architecture/06-data-inventory.md`.
- **Breach response:** `DOCS/runbooks/10-incident-response.md` (CERT-In 6 hours; Data Protection Board without delay and a detailed report within 72 hours; affected people without delay). Owners still to be named by KBS.
- **Cookies:** essential only (`kbs_access`, `kbs_refresh`, `kbs_theme`, `kbs_nav`); no analytics or advertising trackers, so no consent banner.
