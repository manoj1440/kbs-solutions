# Security and privacy controls

Maps REQ-09, REQ-21, REQ-24 to concrete controls. Every row is either **CORE** (built in the foundation) or names the feature that adds it.

| Control | Status | Detail |
|---|---|---|
| OTP-only auth, no password columns | CORE | `OtpChallenge` hashed codes; `User` has no password. |
| OTP rate limits | CORE | `SystemConfig auth.otp.*`; per-mobile and per-IP; lockout after 5 wrong tries. |
| Access/refresh JWT with rotation + reuse detection | CORE | Family revoke on reuse. |
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
| Data retention / deletion authority | BLOCKED (REQ-21 §21.5 OPEN) | Config keys exist with null values; no deletion job until set. |
| Malware scanning provider | F-902 | ClamAV adapter. |
| DB-level trigger protecting bank-status columns | F-903 | |
