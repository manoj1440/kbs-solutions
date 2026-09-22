# Features index and roadmap

Each feature file is the unit of work: small enough for one session, fully traceable to `REQ-xx` sections and QA ids. Statuses: `PLANNED` → `IN_PROGRESS` → `DONE`; `BLOCKED` = cannot proceed until a business/legal OPEN item is resolved (see `DOCS/analysis/01-gap-analysis.md`).

## Build order (roadmap)

1. **Foundation** F-001 → F-006 (this is the 'core' that must exist before anything else).
2. **Core services** F-107, F-109, F-103, F-104, F-101, F-102, F-110, F-108, F-111, F-105, F-106.
3. **Shells** F-803, F-801, F-802 (login + role routing on both platforms).
4. **Vertical slice 1 — Telecaller lifecycle**: F-201, F-202, F-203, F-204, F-205, F-301, F-302.
5. **Vertical slice 2 — Calling desk**: F-306, F-304, F-303, F-305, F-403, F-404, F-308, F-307, F-312, F-309, F-310, F-311, F-313.
6. **Vertical slice 3 — Advisor**: F-401, F-402, F-405, F-406, F-407.
7. **Vertical slice 4 — MIS**: F-501, F-502, F-504, F-503, F-505, F-506, F-408, F-409, F-410, F-507.
8. **Vertical slice 5 — Payouts**: F-601, F-602, F-603, F-604, F-605, F-606.
9. **Cross-cutting**: F-701, F-702, F-703, F-704.
10. **Hardening/release**: F-901 → F-906.

## Index

| File | Title | Group | Status | Depends on |
|---|---|---|---|---|
| [F-001-monorepo-tooling.md](./F-001-monorepo-tooling.md) | F-001 Monorepo tooling | Foundation | DONE | — |
| [F-002-infra-and-env.md](./F-002-infra-and-env.md) | F-002 Local infrastructure and environment files | Foundation | DONE | F-001 |
| [F-003-app-scaffolds.md](./F-003-app-scaffolds.md) | F-003 Application scaffolds (api, web, mobile) | Foundation | DONE | F-001, F-002 |
| [F-004-shared-package.md](./F-004-shared-package.md) | F-004 `@kbs/shared` contracts package | Foundation | DONE | F-001 |
| [F-005-database-schema.md](./F-005-database-schema.md) | F-005 `@kbs/db` Prisma schema — full domain | Foundation | DONE | F-001, F-002, F-004 |
| [F-006-ui-tokens.md](./F-006-ui-tokens.md) | F-006 `@kbs/ui-tokens` design tokens | Foundation | DONE | F-001 |
| [F-101-otp-authentication.md](./F-101-otp-authentication.md) | F-101 OTP-only authentication and sessions | Core | DONE | F-003, F-004, F-005, F-109 |
| [F-102-rbac-and-scoping.md](./F-102-rbac-and-scoping.md) | F-102 RBAC, permissions matrix and data scoping | Core | DONE | F-101 |
| [F-103-audit-and-logging.md](./F-103-audit-and-logging.md) | F-103 Audit log, sensitive-access log, request ids, redacted logging | Core | DONE | F-003, F-005 |
| [F-104-system-config.md](./F-104-system-config.md) | F-104 SystemConfig with history and launch-gate checklist | Core | IN_PROGRESS | F-005, F-102, F-103 |
| [F-105-user-administration.md](./F-105-user-administration.md) | F-105 User administration and lifecycle | Core | IN_PROGRESS | F-101, F-102, F-103 |
| [F-106-reporting-hierarchy-agent-codes.md](./F-106-reporting-hierarchy-agent-codes.md) | F-106 Reporting hierarchy and Agent Codes | Core | DONE | F-105 |
| [F-107-common-http-conventions.md](./F-107-common-http-conventions.md) | F-107 Common HTTP conventions: envelope, errors, pagination, idempotency | Core | DONE | F-003, F-004 |
| [F-108-files-module.md](./F-108-files-module.md) | F-108 Files: upload, storage port, scan status, presigned access | Core | DONE | F-102, F-103, F-109 |
| [F-109-provider-ports.md](./F-109-provider-ports.md) | F-109 Provider ports and mock adapters | Core | DONE | F-003 |
| [F-110-jobs-and-outbox.md](./F-110-jobs-and-outbox.md) | F-110 Background jobs (BullMQ), worker mode and outbox | Core | IN_PROGRESS | F-002, F-003 |
| [F-111-access-gates.md](./F-111-access-gates.md) | F-111 Access gates (training / network / onboarding) in `/auth/me` and guards | Core | DONE | F-101, F-102, F-104 |
| [F-201-manager-creates-telecaller.md](./F-201-manager-creates-telecaller.md) | F-201 Manager creates Telecaller (name + mobile) with employee code | Training | DONE | F-105, F-106 |
| [F-202-training-content-admin.md](./F-202-training-content-admin.md) | F-202 Training content administration (modules, videos, MCQs, thresholds) | Training | DONE | F-104, F-108 |
| [F-203-training-enrollment-and-gate.md](./F-203-training-enrollment-and-gate.md) | F-203 Training enrollment, 72-hour window, sequential modules, assessment | Training | DONE | F-111, F-201, F-202 |
| [F-204-training-expiry-and-reactivation.md](./F-204-training-expiry-and-reactivation.md) | F-204 Deadline expiry deactivation and Manager reactivation | Training | DONE | F-110, F-203 |
| [F-205-training-visibility.md](./F-205-training-visibility.md) | F-205 Training progress visibility for Manager and Admin | Training | DONE | F-203, F-204 |
| [F-301-office-network-policy.md](./F-301-office-network-policy.md) | F-301 Office-network policy, WFH exceptions and network gate | Telecaller ops | IN_PROGRESS | F-104, F-111 |
| [F-302-mobile-secure-screens.md](./F-302-mobile-secure-screens.md) | F-302 Android protected screens (FLAG_SECURE) and residual-risk documentation | Telecaller ops | IN_PROGRESS | F-802 |
| [F-303-customer-list-import.md](./F-303-customer-list-import.md) | F-303 Admin customer calling-list import | Telecaller ops | DONE | F-108, F-110, F-104, F-306 |
| [F-304-pincode-master.md](./F-304-pincode-master.md) | F-304 Pincode master reference and location resolution | Telecaller ops | DONE | F-108 |
| [F-305-automatic-allocation.md](./F-305-automatic-allocation.md) | F-305 Automatic allocation of accepted records to trained Telecallers | Telecaller ops | DONE | F-303, F-203, F-104 |
| [F-306-contact-suppression.md](./F-306-contact-suppression.md) | F-306 Contact suppression (do-not-contact) enforcement | Telecaller ops | DONE | F-005, F-103 |
| [F-307-calling-queue.md](./F-307-calling-queue.md) | F-307 Telecaller calling queue, follow-ups, hidden history | Telecaller ops | DONE | F-111, F-305, F-306, F-802 |
| [F-308-card-lookup-by-pincode.md](./F-308-card-lookup-by-pincode.md) | F-308 Card lookup by customer pincode (sourceability ∩ publication) | Telecaller ops | DONE | F-403, F-404, F-307 |
| [F-309-call-initiation-and-recording.md](./F-309-call-initiation-and-recording.md) | F-309 In-app call initiation via telephony port, provider events, recordings | Telecaller ops | DONE | F-109, F-307, F-108 |
| [F-310-call-outcomes-and-interest.md](./F-310-call-outcomes-and-interest.md) | F-310 Call outcomes, operational remarks, follow-up/hide, calling interest | Telecaller ops | DONE | F-309, F-306 |
| [F-311-whatsapp-sharing.md](./F-311-whatsapp-sharing.md) | F-311 WhatsApp sharing: benefit PDF, official ID, application link | Telecaller ops | DONE | F-109, F-308, F-312, F-403 |
| [F-312-official-id-card.md](./F-312-official-id-card.md) | F-312 Official Telecaller ID card | Telecaller ops | DONE | F-201, F-108 |
| [F-313-manager-team-operations.md](./F-313-manager-team-operations.md) | F-313 Manager team operations views | Telecaller ops | DONE | F-205, F-305, F-309, F-310, F-311 |
| [F-401-advisor-onboarding.md](./F-401-advisor-onboarding.md) | F-401 Advisor self-registration and verified onboarding | Advisor | DONE | F-101, F-108, F-109, F-111 |
| [F-402-agent-code-in-onboarding-and-profile.md](./F-402-agent-code-in-onboarding-and-profile.md) | F-402 Agent Code in signup and profile (Advisor-facing) | Advisor | DONE | F-106, F-401 |
| [F-403-card-catalogue-admin.md](./F-403-card-catalogue-admin.md) | F-403 Bank and credit-card catalogue administration | Advisor | DONE | F-108, F-104 |
| [F-404-bank-pincode-profiles-and-import.md](./F-404-bank-pincode-profiles-and-import.md) | F-404 Bank-specific pincode profiles, import and sourceability | Advisor | DONE | F-108, F-110, F-403 |
| [F-405-advisor-catalogue-browse.md](./F-405-advisor-catalogue-browse.md) | F-405 Advisor card discovery: catalogue, categories, search, filters, detail | Advisor | DONE | F-403, F-404, F-802 |
| [F-406-advisor-create-lead.md](./F-406-advisor-create-lead.md) | F-406 Advisor creates customer operational lead (multi-step) | Advisor | DONE | F-405, F-304, F-109, F-107 |
| [F-407-link-initiation-and-bank-reference.md](./F-407-link-initiation-and-bank-reference.md) | F-407 Application-link initiation and bank reference linkage | Advisor | DONE | F-406, F-311, F-403 |
| [F-408-my-leads-and-lead-detail.md](./F-408-my-leads-and-lead-detail.md) | F-408 My Leads list, search, filters and lead detail with MIS history | Advisor | PLANNED | F-407, F-506 |
| [F-409-pending-actions-and-followup-tasks.md](./F-409-pending-actions-and-followup-tasks.md) | F-409 Pending Actions and operational follow-up tasks | Advisor | PLANNED | F-408, F-701 |
| [F-410-advisor-profile-and-support.md](./F-410-advisor-profile-and-support.md) | F-410 Advisor profile and support | Advisor | PLANNED | F-401, F-402 |
| [F-501-mis-import-profiles.md](./F-501-mis-import-profiles.md) | F-501 MIS import profiles (bank/version) with HDFC v1 seed | MIS | DONE | F-104, F-403 |
| [F-502-mis-upload-parse-map.md](./F-502-mis-upload-parse-map.md) | F-502 MIS upload, parse and map stages (raw preservation) | MIS | DONE | F-501, F-108, F-110 |
| [F-503-mis-preview.md](./F-503-mis-preview.md) | F-503 MIS preview and anomaly report | MIS | DONE | F-502, F-504 |
| [F-504-mis-matching-and-quarantine.md](./F-504-mis-matching-and-quarantine.md) | F-504 Deterministic MIS matching, quarantine and Admin resolution | MIS | DONE | F-502, F-407 |
| [F-505-mis-apply-snapshot-history.md](./F-505-mis-apply-snapshot-history.md) | F-505 MIS apply: snapshot, change history, delta/full semantics, idempotency | MIS | DONE | F-504, F-110 |
| [F-506-status-display-dtos-and-components.md](./F-506-status-display-dtos-and-components.md) | F-506 Status display: DTO shaping, web table, mobile row, badges | MIS | DONE | F-505, F-803 |
| [F-507-mis-integrity-dashboard.md](./F-507-mis-integrity-dashboard.md) | F-507 MIS integrity and freshness dashboard, unmatched cases | MIS | PLANNED | F-505, F-504 |
| [F-601-payout-rules-and-rates.md](./F-601-payout-rules-and-rates.md) | F-601 Payout rules and rate tables (versioned, per bank) | Payouts | PLANNED | F-104, F-403 |
| [F-602-entitlement-evaluation.md](./F-602-entitlement-evaluation.md) | F-602 Entitlement evaluation from applied MIS batches | Payouts | PLANNED | F-601, F-505, F-106 |
| [F-603-advisor-payout-request-and-reservation.md](./F-603-advisor-payout-request-and-reservation.md) | F-603 Advisor payout ledger and request creation with atomic reservation | Payouts | PLANNED | F-602, F-107 |
| [F-604-dual-approval.md](./F-604-dual-approval.md) | F-604 Dual approval (Manager + Admin), rejection and release | Payouts | PLANNED | F-603 |
| [F-605-accounts-payment-recording.md](./F-605-accounts-payment-recording.md) | F-605 Accounts queue, external payment record, proof and paid state | Payouts | PLANNED | F-604, F-108 |
| [F-606-payout-reconciliation-and-exceptions.md](./F-606-payout-reconciliation-and-exceptions.md) | F-606 Payout reconciliation views and exception handling | Payouts | PLANNED | F-605, F-602 |
| [F-701-notifications.md](./F-701-notifications.md) | F-701 Notifications: outbox fan-out, in-app centre, push, dedupe, deep links | Dashboards & notifications | PLANNED | F-110, F-109, F-102 |
| [F-702-manager-dashboard.md](./F-702-manager-dashboard.md) | F-702 Manager dashboard | Dashboards & notifications | PLANNED | F-313, F-408, F-602, F-604 |
| [F-703-admin-dashboards.md](./F-703-admin-dashboards.md) | F-703 Admin dashboards (executive, telecaller, manager, advisor, bank/card mix, payouts) | Dashboards & notifications | PLANNED | F-702, F-507, F-606 |
| [F-704-audit-dashboard.md](./F-704-audit-dashboard.md) | F-704 Data and permissions audit dashboard | Dashboards & notifications | PLANNED | F-103, F-104 |
| [F-801-web-shell.md](./F-801-web-shell.md) | F-801 Web shell: layout, navigation, OTP login, role routing | UX shells | IN_PROGRESS | F-003, F-006, F-101, F-111 |
| [F-802-mobile-shell.md](./F-802-mobile-shell.md) | F-802 Mobile shell: Expo Router, OTP login, gates routing, base components | UX shells | IN_PROGRESS | F-003, F-006, F-101, F-111 |
| [F-803-status-and-provenance-components.md](./F-803-status-and-provenance-components.md) | F-803 Shared status/provenance component set (web + mobile) | UX shells | IN_PROGRESS | F-006, F-004 |
| [F-901-ci-and-e2e.md](./F-901-ci-and-e2e.md) | F-901 CI hardening and end-to-end suites | Hardening | PLANNED | F-801, F-802 |
| [F-902-malware-scanning.md](./F-902-malware-scanning.md) | F-902 Malware scanning adapter (ClamAV) | Hardening | PLANNED | F-108 |
| [F-903-db-level-bank-status-protection.md](./F-903-db-level-bank-status-protection.md) | F-903 Database-level protection of bank-status tables | Hardening | PLANNED | F-505 |
| [F-904-data-retention.md](./F-904-data-retention.md) | F-904 Data retention and deletion authority (BLOCKED) | Hardening | BLOCKED | F-104 |
| [F-905-performance-acceptance.md](./F-905-performance-acceptance.md) | F-905 Performance acceptance harness | Hardening | PLANNED | F-505, F-307 |
| [F-906-android-release.md](./F-906-android-release.md) | F-906 Android APK build and release checklist | Hardening | PLANNED | F-802, F-302 |
