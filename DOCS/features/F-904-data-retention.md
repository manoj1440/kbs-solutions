# F-904 Data retention and deletion authority (BLOCKED)

- Group: Hardening · Status: **BLOCKED** · Depends on: F-104
- PRD refs: REQ-21 §21.5 (OPEN), REQ-24 §24.4, INV-07

## Scope
Retention jobs for recordings/documents/calling records driven by `retention.*` config; restriction (not deletion) of records under legal hold; never removes MIS/payout audit. Cannot start until KBS sets retention values.

## Progress notes
- Session 8: status stays **BLOCKED** (retention durations are OPEN, REQ-21 §21.5). Building the structure fail-closed: dry-run plan, legal hold, and an execute path that refuses (`CONFIG_MISSING`) until KBS sets `retention.*Days` and turns on `retention.executionEnabled`.
- Schema (migration `20260923150000_retention_structure`): `StoredFile.legalHold/legalHoldReason/purgedAt`, `CallingRecord.legalHold/legalHoldReason/restrictedAt`. New config key `retention.executionEnabled` (BOOL, default **false**).
- API (`modules/retention`, Admin + `CONFIG_MANAGE`):
  - `GET /retention/plan` — read-only dry run per category (RECORDINGS, DOCUMENTS, MIS_FILES, CALLING_RECORDS): configured days, cutoff, past-cutoff / legal hold / protected / eligible counts, already done.
  - `POST /retention/execute {category, reason, limit≤5000}` — `CONFIG_MISSING` unless the category's `retention.*Days` is set **and** `retention.executionEnabled` is on. Files: row claimed (`purgedAt`), then object deleted via new `StorageProvider.delete`; delete failure rolls the claim back. Calling records: name/mobile/PAN redacted, hidden, `restrictedAt` set — never deleted (INV-07). Hold re-checked inside each write. Audited per item (`retention.purgeFile` / `retention.restrictRecord`) and per run (`retention.execute`).
  - `GET/POST /retention/legal-holds` — place/release a hold on a file or calling record (audited `legalHold.set`); a purged file cannot be held (410).
- Protected even when old: payment proofs linked to an `ExternalPayment` (payout audit), cheques still referenced by an Advisor profile, rendered files of non-revoked ID cards, MIS files whose batch is not APPLIED/REJECTED/FAILED, quarantined (INFECTED) uploads; calling records still in an active queue or with an open follow-up.
- Out of scope by construction: MIS rows, bank status snapshots/history, payout entitlements/requests/payments, audit and sensitive-access logs, contact suppressions.
- Purged files: `GET /files/:id/url`, share redirects, rescan and server-side reads refuse with 410 `FILE_PURGED`.
- Web: `/admin/retention` (Administration → Retention & legal hold) — blocked banner listing missing keys, dry-run table, Run button disabled until runnable, legal-hold form and list.
- Tests: `apps/api/test/retention.e2e-spec.ts` (fail-closed, legal hold, protections, purge trace, restriction without deletion).
- **Still BLOCKED on KBS:** the four durations, whether purge should be scheduled (a nightly maintenance job can call `execute` per category once approved — not wired, deliberately), and whether restriction must also cover call-outcome notes and share-action records.

## Acceptance criteria
- [x] Retention driven by `retention.*` config; nothing runs while values are unset (fails closed).
- [x] Legal hold restricts retention for the held item.
- [x] Calling records restricted, not deleted (INV-07).
- [x] MIS/payout audit never removed.
- [ ] KBS-approved durations set (OPEN, REQ-21 §21.5).
- Session 8 (resume): adding a scheduled nightly run behind its own flag `retention.scheduleEnabled` (default false), still BLOCKED on durations.
- Session 8 (scheduled run): `retention.nightly` on the maintenance queue at 02:00 IST (worker mode). Runs only when **both** `retention.scheduleEnabled` (new, default false) and `retention.executionEnabled` are on, only for categories whose duration is set, as the system actor; audit `retention.scheduledRun` per run + per-item rows; Admin SECURITY_EVENT when anything was purged/restricted or failed. `MaintenanceProcessor.schedule()` lets modules contribute repeatable jobs. `/admin/retention` shows the nightly state. Test added to `retention.e2e-spec.ts`. Status stays **BLOCKED** on KBS durations.
