# PRD deep analysis — gaps, risks and better approaches

Source analysed: `DOCS/requirements/` (verbatim PRD v1.0, 22 Sep 2026). This document records what the PRD does **not** say, what it says ambiguously, and where a better engineering approach exists. Every item here has a disposition: **ADOPTED** (we build it this way; recorded as an ADR in `DOCS/decisions/`), **CONFIGURABLE** (we build a switch with a safe default and the business can change it later), or **BLOCKED** (cannot be safely built without a business/legal answer; we build the surrounding structure and a stub/placeholder that fails closed).

The PRD's own list of OPEN items is in `REQ-28`. This analysis goes further: it lists things the PRD *assumes* but never specifies, and things that will break at implementation time if not decided now.

---

## A. Gaps the PRD does not address at all

### A1. Who creates Managers and Accounts users, and the first Admin
The PRD says Manager/Accounts creation permission is "OPEN" (REQ-03 §3.1) and there is exactly one Admin, but never says how the Admin account itself comes into existence.

- **ADOPTED:** The first Admin is created by a **seed/bootstrap command** (`pnpm db:seed` reads `BOOTSTRAP_ADMIN_MOBILE` from env). Exactly one user with role `ADMIN` may exist; the database enforces it with a partial unique index.
- **ADOPTED (default, changeable):** Admin creates Manager and Accounts users (name + mobile). Nothing else in the PRD makes sense otherwise. Recorded in ADR-006.

### A2. Session and concurrent-session policy
REQ-04 §4.3 marks concurrent-session rules OPEN, but the core must pick something to ship.

- **CONFIGURABLE:** Access token 15 min, refresh token 30 days with rotation and reuse detection; refresh tokens are stored hashed per device; Admin can revoke all sessions for a user. Default allows multiple devices per user (needed: a Manager on mobile and web simultaneously per REQ-03). Telecallers default to **single active session** because the office-network rule is device-bound. Values live in `SystemConfig`.

### A3. Bank application reference capture (P0 in REQ-28)
The whole MIS-matching design depends on a reliable bank reference per lead, and REQ-11 §11.6 admits the mechanism is unknown per issuer.

- **ADOPTED:** Build a `BankApplicationLinkage` entity with a `source` enum: `ADVISOR_ENTERED`, `ADMIN_ENTERED`, `ISSUER_CALLBACK`, `MIS_RESOLVED_BY_ADMIN`. The Advisor may enter the bank application number the customer receives (SMS/e-mail from issuer) in the lead; it is stored as **unverified** until an MIS row with the same bank + reference matches it. Admin can also link an unmatched MIS row to a lead through the audited review flow (REQ-13 §13.4 step 6). No automatic name/mobile matching, ever (INV-08).
- This turns a launch blocker into a working fallback without violating the MIS-only rule: the *status* still only ever comes from MIS; the *reference* can come from a human.

### A4. Pincode → city/state resolution data source
REQ-06 §6.1 says "resolve city/state from validated pincode/reference data where possible" but names no dataset.

- **ADOPTED:** `PincodeMaster` table (pincode, office, district, state) importable by Admin from the public India Post pincode directory CSV. Until imported, UI shows "Location unavailable" exactly as the PRD requires. Bank-specific pincode sheets are **not** used for this (they are sourceability references, REQ-07 §7.1).

### A5. Customer identity across three entities
A "customer" appears as (a) a calling-list row, (b) an Advisor lead's customer, (c) a bank MIS `CUSTOMER_NAME`. REQ-22 §22.1 insists they stay separate, but the PRD never says whether they may be *linked*.

- **ADOPTED:** Three separate tables (`CallingRecord`, `LeadCustomer`, `MisRow`). An optional, explicit, audited `CustomerLink` table can relate a calling record to a lead (for the Telecaller→Advisor collision analytics in REQ-08 §8.7). Linking is manual or by a *configurable* exact key (default: exact mobile + exact PAN, both present). No fuzzy match.

### A6. Do-not-contact suppression key
REQ-08 §8.6 requires suppression "across new imports" but not on what key.

- **ADOPTED:** `ContactSuppression` keyed on normalised mobile (E.164). PAN is deliberately not used as a suppression key (REQ-06 §6.3 forbids PAN as a broad search field). Suppression is checked at import (row goes to Admin exclusion queue) and at call initiation (server-side refusal).

### A7. Background scheduling
72-hour deadlines, MIS processing, notification fan-out and reservation expiry need a job runner. Not mentioned anywhere.

- **ADOPTED:** Redis + BullMQ. Every scheduled effect is **also** checked lazily on read (e.g. training gate computed from `deadlineAt < now()` at request time) so a missed job never grants access. ADR-004.

### A8. Timezone
Bank MIS files carry dates in unknown timezones (REQ-13 §13.7 marks this OPEN). App users are in India.

- **ADOPTED:** Store all instants as UTC `timestamptz`. Bank-supplied dates are stored **twice**: the raw cell text (`rawValue`) and a parsed value with the timezone taken from the bank's import profile (default `Asia/Kolkata`, flagged `timezoneAssumed=true` until the profile is confirmed). Display in `Asia/Kolkata`.

### A9. ID formats
The PRD refers to "KBS lead reference", "request ID", "import batch ID" without formats.

- **ADOPTED:** Human-readable, non-guessable public references: `KBS-L-` + 8-char Crockford base32 for leads, `KBS-PR-` for payout requests, `KBS-B-` for import batches, `KBS-TC-` for Telecaller employee IDs. Internal primary keys are UUIDv7 (time-ordered). Public references never encode customer data.

### A10. File storage and malware scanning
REQ-24 §24.4 requires content-type validation and malware scanning; no provider named.

- **ADOPTED:** S3-compatible object storage behind a `StorageProvider` interface (MinIO in dev, any S3 in prod). Presigned download URLs with 5-minute expiry. Malware scanning behind a `ScanProvider` interface with a ClamAV implementation planned; the default dev implementation is a **no-op that marks files `scanStatus=SKIPPED`** and the UI shows that. Files are not servable to non-Admin roles until `scanStatus=CLEAN` (configurable, default on in prod).

### A11. Observability / PII in logs
REQ-24 §24.3: "Avoid storing raw PII in logs."

- **ADOPTED:** Structured JSON logging (pino) with a redaction list (mobile, pan, aadhaar, accountNumber, otp, token, authorization). Request IDs propagated from client to API to jobs. Audit log is a **database table**, not the log stream.

### A12. Multi-tenancy
The PRD describes one company. Nothing says the product will be sold to other DSAs.

- **ADOPTED:** Single-tenant. No `organizationId` column. This keeps every RBAC check simpler and the PRD's "one Admin" invariant literal. Revisit only if the business changes; adding a tenant column later is a mechanical migration.

### A13. Web access for Advisors and Telecallers
REQ-02 §2.3: "other role web access only where deliberately permitted."

- **CONFIGURABLE (default off):** `SystemConfig.webAccessRoles` default `[ADMIN, MANAGER, ACCOUNTS]`. The web login refuses other roles with the role-aware access error screen.

### A14. Rate table and rule versioning
REQ-17 mentions "rate/rule version" repeatedly but no entity.

- **ADOPTED:** `PayoutRule` (bank, product code pattern, trigger field, trigger values, hold days, effective from/to, version) and `PayoutRate` (rule, amount, effective from/to). Entitlement evaluation snapshots `ruleVersionId` and `rateVersionId`. Until KBS supplies real rules, the seed contains **no active rule**, so no entitlement can become eligible — the system fails closed exactly as REQ-28 §28.2 demands.

### A15. Admin-direct Advisor: who gives the Manager approval (P0)
- **ADOPTED (structure), BLOCKED (value):** `SystemConfig.designatedApproverManagerUserId`. Payout request creation for an Advisor whose parent is Admin **refuses** with a clear error while this is null. No approval step is ever skipped.

### A16. Full-snapshot vs delta MIS semantics (P0)
- **CONFIGURABLE per import profile:** `snapshotMode = DELTA | FULL_SNAPSHOT`, default `DELTA` with `blankOverwrites=false`. Under DELTA a blank/`#N/A` cell never overwrites a known value; it is recorded in history as "reported blank" so the audit is complete. Under FULL_SNAPSHOT, absence of a previously matched lead is recorded as "not present in batch" but still does not change bank values (REQ-13 §13.6 row 3).

### A17. Reservation release policy for rejected/abandoned payout requests
- **CONFIGURABLE:** On Manager or Admin rejection, entitlements are released immediately (request → `REJECTED`, entitlements → `AVAILABLE`, both logged). A request pending longer than `payoutRequestStaleDays` (default 30) is flagged in the Admin exceptions dashboard; it is **not** auto-cancelled (PRD says cancellation authority is OPEN).

### A18. Accessibility vs FLAG_SECURE
REQ-20 §20.5 warns not to block assistive tech silently. Android `FLAG_SECURE` does not block screen readers, only capture. Documented in the mobile security ADR; no extra restriction on accessibility services.

---

## B. Ambiguities in the PRD that would cause divergent implementations

| # | Ambiguity | Resolution |
|---|-----------|-----------|
| B1 | "Modules intended for corresponding training day" vs single 72-h window (REQ-05 §5.2) | Only the 72-h window is enforced. Days are labels in content only. |
| B2 | Training pass rule: per-module vs average (REQ-05 §5.3) | `TrainingConfig.passRule = PER_MODULE_THRESHOLD` (default) or `AVERAGE_ACROSS_MODULES`; threshold percentage per module; attempt limit nullable (=unlimited); video-completion-required boolean. All Admin-editable, versioned. |
| B3 | Reactivation window after Manager reactivation (REQ-05 §5.4) | `TrainingConfig.reactivationWindowHours` — **null = BLOCKED**: Manager reactivation UI shows the window that will apply; if unset the reactivation succeeds but the Telecaller gets an explicit "training window not configured — contact Admin" and stays gated. Fails closed. |
| B4 | "Approval order" for dual approval (REQ-17 §17.5) | Two independent approval records; either order; Accounts queue requires both. `payoutApprovalOrder = ANY | MANAGER_FIRST` config, default `ANY` because PRD says order is not mandated. |
| B5 | "Connected" call definition (REQ-16 §16.3) | Only provider-confirmed `answered` events count as connected. Anything user-entered is an *outcome*, shown in a separate column. |
| B6 | Telecaller "lead" (REQ-08 §8.7) | Modelled as `CallingInterest` on the calling record (card, link version, timestamp). It is not a `Lead`. Never carries an entitlement. |
| B7 | Agent Code re-pointing effect on history (REQ-10 §10.4) | `ReportingAssignment` is effective-dated. Every lead snapshots `reportingParentUserId` at creation; every entitlement snapshots it at eligibility time. Changing the code affects only future leads. Reparenting requires Admin approval (config `agentCodeChangeRequiresAdminApproval`, default true). |
| B8 | What "office network" means server-side (REQ-09 §9.1) | Server evaluates the request's egress IP against `OfficeNetwork` allowlist (CIDRs). SSID is reported by the app as a *hint only* and logged. WFH exception = effective-dated row per Telecaller. Fails closed if the allowlist is empty and no exception exists — Admin must configure before Telecallers can work. |
| B9 | OTP length/expiry (REQ-12 S07) | 6 digits, 5-minute expiry, 60-second resend cooldown, 5 wrong attempts then 15-minute lock per mobile, 10 sends/hour per mobile and per IP. All in `SystemConfig`. |
| B10 | "Hidden" vs "suppressed" calling records | Two different flags. `hiddenAt` (queue hygiene, reversible, per-record) and `ContactSuppression` (do-not-contact, by mobile, survives re-imports). |
| B11 | Payout "Paid" with proof — proof mandatory? | Proof file mandatory to reach `PAID`; a record without proof stays `PAYMENT_RECORDED_PENDING_PROOF` and appears in exceptions. Configurable `proofRequiredForPaid` default true. |

---

## C. Risks and how the architecture defends against them

| Risk | Defence |
|------|---------|
| Bank status accidentally set by app code (INV-01) | Bank-status columns live in `BankStatusSnapshot`, writable **only** by the MIS apply service; Prisma extension throws if any other module writes to it; DB role for the API has no `UPDATE` on those columns except via a `SECURITY DEFINER` function used by the import job (phase 2 hardening). |
| Double payout (INV-06) | `PayoutEntitlement` has a partial unique index on `(id) WHERE state IN ('RESERVED','PAID')` referenced by `PayoutRequestItem`; reservation is a single DB transaction with `SELECT ... FOR UPDATE`; request submission carries an idempotency key. |
| Duplicate MIS effects on re-upload (REQ-13 §13.6 row 9) | Batch checksum (SHA-256 of file bytes) unique per bank; row hash unique per batch; history rows unique on `(leadId, batchId, field)`. |
| Name-based mis-linking (INV-08) | No code path takes a name into the matcher. Matcher input is `(bankId, referenceKind, referenceValue)` only. |
| PII leakage | Redacted logs, masked DTOs by default with explicit `reveal` endpoints that write an `AuditLog` row, PAN encrypted at rest (AES-GCM, key from env/KMS), Aadhaar number never stored (only verification result + provider reference). |
| Provider lock-in / unknown vendors | Every external capability is a port: `OtpProvider`, `TelephonyProvider`, `WhatsAppProvider`, `KycProvider`, `PanVerificationProvider`, `StorageProvider`, `PushProvider`, `ScanProvider`. Dev adapters are deterministic mocks. |
| Job missed → wrong access | All gates are evaluated at request time from persisted timestamps; jobs only *notify* and *materialise* state. |
| Excel parsing hazards | Workbooks parsed with `exceljs` in a worker with size limits; formulas ignored, values only; cells always read as text first to preserve leading zeros (REQ-07 §7.3). |

---

## D. Better approaches than a literal reading of the PRD

1. **MIS import as a staged, resumable pipeline** rather than one big transaction: `UPLOADED → PARSED → MAPPED → PREVIEWED → APPLYING → APPLIED | FAILED`. Every stage is idempotent and persisted, so a crash at row 40,000 does not lose the batch or double-apply. Admin previews (REQ-13 §13.4 step 3) come for free from the `MAPPED` stage.
2. **Append-only ledgers** for bank status history, payout entitlement events and audit. Current state is a materialised column updated in the same transaction. This satisfies INV-04, INV-06, INV-07 and §24.3 with one pattern.
3. **A single `Lead` table with a `kind` column?** No — rejected. Advisor leads and Telecaller interests have different lifecycles and legal weight (INV-05). Separate tables, separate modules.
4. **Provenance chips as data, not UI convention.** Every status-bearing DTO carries `provenance: 'BANK_MIS' | 'KBS_OPERATIONAL' | 'KBS_PAYMENT'` and `asOf` so web and mobile render the REQ-20 §20.3 chips from the same field.
5. **Shared Zod schemas** in `packages/shared` are the contract between API, web and mobile. The API validates with them, the clients infer types from them. No hand-written duplicate DTOs.
6. **Config with history**: `SystemConfig` is key/value with a `SystemConfigHistory` table; every OPEN value the PRD asks to be "Admin-configurable" is a key here with a documented default and a `requiresValueBeforeProd` flag that the Admin dashboard surfaces as a launch-gate checklist (REQ-28 §28.2 made visible in-product).
7. **Feature files are the unit of work** (`DOCS/features/`). Each is small enough to finish in one session and lists exactly which REQ paragraphs it satisfies and which QA-matrix ids it must pass.

---

## E. Things explicitly NOT built (and why)

- Bank/aggregator status APIs, activation verifiers (REQ-02 §2.2, REQ-28 §28.1).
- In-app money movement (REQ-17 §17.6).
- Clawback/refund modules (REQ-17 §17.7).
- Leaderboards, targets, incentives, TDS/GST statements (REQ-02 §2.2).
- iOS build targets (kept possible by Expo, but not configured).
- Any real vendor SDK until contracts exist; only ports + mocks.
