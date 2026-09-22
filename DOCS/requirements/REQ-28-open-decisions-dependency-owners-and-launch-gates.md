<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 28. Open decisions, dependency owners and launch gates

The following items are not missing from the PRD; they are **genuinely
unspecified business or contract facts** in the supplied source.
Engineering must not fill them with undocumented guesses. Owners are
proposed functional owners, not named individuals.

| **Priority** | **Decision / why it matters**                                                                                                                                     | **Proposed owner / required resolution**                                                |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| P0           | Exact identifier returned by each issuer/link so a KBS Advisor lead can match MIS without name/mobile guessing.                                                   | Bank partnerships + Admin: test issuer journeys and approve reference linkage per bank. |
| P0           | Which bank MIS field/value proves a commission-eligible **activation event** for each bank; HDFC V + ACTIVE vs TXN ACTIVE - Rs 100 vs payout settlement criteria. | Finance + bank partnerships: signed per-bank payout rule/version and examples.          |
| P0           | Per-bank payout rates, rate effective dates, payout eligibility hold, duplicate/reissued card event identity and rate-change treatment.                           | Owner/Admin + Finance: approved commercial rate schedule and card-event key.            |
| P0           | Both approvals for Advisor with **Admin as direct parent**; no Manager is naturally assigned.                                                                     | Owner/Admin: designate independent Manager approver and auditable route.                |
| P0           | Eligibility for purchased third-party customer list, DND/suppression checks, lawful consent, call timing, record retention/recording disclosure and WhatsApp use. | Compliance + telephony/communications provider: written SOP before activation.          |
| P0           | Permissible Aadhaar verification mode and vendor/entity authorization; PAN and payout-bank verification mode.                                                     | Compliance + onboarding: provider agreements, consent text, data scope/retention.       |
| P0           | Telephony provider feasibility of in-app originating/bridging, automatic legal recording, caller ID, recordings retrieval and full current pricing.               | Engineering + operations: proof of concept and vendor quote.                            |
| P0           | Bank MIS file semantics: full snapshot versus delta, blank cell meaning, conflicting row ordering, bank timezone and corrections.                                 | Bank operations + Admin: one approved profile per bank.                                 |
| P1           | Admin-card catalogue source: actual issuer/card product inventory, benefits PDFs, accurate fees, active links and product-code-to-pincode mapping.                | Product/Bank operations: approved canonical card entries.                               |
| P1           | Agent Code points to Manager or another person; effect of later code change on old vs future leads, reserved/paid payouts and approvals.                          | Owner/Admin + Finance: effective-dated attribution policy.                              |
| P1           | Telecaller training passing formula, video completion, retry limits and exact new deadline after Manager reactivation.                                            | Operations + training Admin: approved configuration.                                    |
| P1           | Calling-record dedup key, allocation policy, reassignment and lead-collision rules with an Advisor on same customer.                                              | Admin/Operations: explicit record ownership and reporting rules.                        |
| P1           | Official Telecaller ID card fields/verification, expiration/revocation and customer share rules.                                                                  | Admin + compliance: approved card template.                                             |
| P1           | WFH network policy: authorized office egress IPs, dynamic IP/VPN, exception duration, device security and offline handling.                                       | IT/security + Admin: enforceable access policy.                                         |
| P1           | Payment rejection/cancellation/reservation release, partial payments, payout disputes and correction workflow (without building clawbacks).                       | Finance + Admin: approved finite-state payment SOP.                                     |
| P1           | Current user load, number of records/day, calls/month, file sizes, document/recording retention, report refresh and response thresholds.                          | Owner/Admin + operations/engineering: capacity and acceptance targets.                  |
| P2           | Exact Manager/Accounts creation and general account-disable permissions; optional Admin/Accounts mobile access.                                                   | Owner/Admin: access matrix final sign-off.                                              |
| P2           | Optional customer-facing follow-up messaging, notification channels, escalation/quiet hours and export/print policy.                                              | Product/Compliance: approved channel/permissions policy.                                |

## 28.1 Vendor selection and cost analysis workstream (bounded scope)

The original request asks for reliable low-cost third-party
integrations. Compare **only support services actually needed**: OTP
(unit price, resend and fraud controls), lawful Aadhaar/PAN/bank
verification (per check, retries and regulatory authorization),
telephony (connected vs attempted minute billing, number rental,
call-bridging, recording/storage/retrieval, SLA, recordings consent) and
WhatsApp (app hand-off vs Business Platform media/template/session
pricing, document hosting, template approval and delivery reports).
Collect dated, written India-market vendor quotes and forecast cost
using KBS's actual monthly user/verification/call/message volumes. No
unverified price or vendor is mandated in this PRD. **Do not** add an
aggregator/bank activation-status API: MIS remains the bank-status
source of truth.

## 28.2 Release gates

No production calling until consent/DND/recording/office-network
safeguards and approved provider are operational. No live Aadhaar flow
until lawful mode and processing agreements are approved. No automatic
Advisor payout eligibility until bank-specific MIS trigger, reference
matching, approved commercial rate and Admin-direct dual-approval
routing are configured and tested. All three sample workbook schemas
must pass import QA before the upload workflow is considered validated;
live bank files may require additional per-bank profiles.
