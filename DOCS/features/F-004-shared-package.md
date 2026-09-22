# F-004 `@kbs/shared` contracts package

- Group: Foundation · Status: **PLANNED** · Depends on: F-001 · ADR-010
- PRD refs: REQ-13 §13.6 (display rules), REQ-14 §14.2–14.4, REQ-20 §20.3 (provenance chips), REQ-21 §21.1 (masking), REQ-03 (roles)

## Scope
- `enums.ts`: `Role`, `UserStatus`, `Platform`, `Provenance` (`BANK_MIS | KBS_OPERATIONAL | KBS_PAYMENT`), `InteractionStatus`, `CallOutcome`, `CallProviderState`, `RecordingStatus`, `ShareKind`, `EmploymentType`, `MisBatchStage`, `MisRowMatchState`, `BankStatusChangeKind`, `PayoutEntitlementState`, `PayoutRequestState`, `ApprovalRole`, `ApprovalDecision`, `ExternalPaymentState`, `TrainingEnrollmentStatus`, `ModuleResultStatus`, `FileScanStatus`, `NotificationKind`, `Sourceability`.
- `errors.ts`: `ErrorCode` enum (AUTH_*, RBAC_*, GATE_TRAINING_BLOCKED, GATE_NETWORK_BLOCKED, GATE_ONBOARDING_INCOMPLETE, VALIDATION_FAILED, IDEMPOTENT_REPLAY, NOT_FOUND, CONFLICT, MIS_*, PAYOUT_*, CONFIG_MISSING…) with HTTP status map.
- `permissions.ts`: `Permission` enum + `ROLE_PERMISSIONS` matrix (ADR-006) — the single RBAC source.
- `display.ts`: `bankValueDisplay(raw: string|null|undefined, matched: boolean)` → `'Awaiting MIS Update' | 'Not reported' | raw`; `isBlankBankValue()` treats `''`, `#N/A`, `N/A`, `NA`, `null`, `-` (configurable list) as blank. `StatusField` type `{ value, raw, provenance, asOf, batchRef, display }`.
- `mask.ts`: `maskMobile`, `maskPan`, `maskAccount`; `normalize.ts`: `toE164India`, `normalizePincode` (string, 6 chars, leading zeros), `normalizePan` (uppercase, regex `[A-Z]{5}[0-9]{4}[A-Z]`).
- `refs.ts`: `makePublicRef(prefix)` Crockford base32 (ADR-012).
- `money.ts`: INR formatting helpers (`formatInr` with Indian grouping).
- `schemas/`: Zod for auth (`OtpRequest`, `OtpVerify`), common (`Pagination`, `ApiEnvelope`), user, config — extended by later features.
- `client/`: minimal typed `apiFetch` with envelope parsing (used by web & mobile).
- Vitest unit tests for display, mask, normalize, refs.

## Acceptance criteria
- [ ] `bankValueDisplay('#N/A', true) === 'Not reported'`; `bankValueDisplay(null,false) === 'Awaiting MIS Update'` (MIS-03, MIS-04).
- [ ] `normalizePincode('  302001 ') === '302001'`, `normalizePincode(302001 as any)` throws (PIN-03).
- [ ] Package builds to ESM+CJS with types.
