<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 24. Non-functional and operational acceptance requirements

## 24.1 Reliability and data correctness

MIS import must be idempotent for identical source batches, preserve raw
files and never partially publish inconsistent calculations as a
finished update. Payment reservations and settlement must avoid
duplicate entitlement use. Search, reporting and notifications must
respect row-level permissions. Failed operations should have
retry/reconciliation without creating duplicate calls, lead submissions,
MIS transitions or payouts.

## 24.2 Scalability and performance

Design for unknown production sizes: number of
Telecallers/Advisors/Managers, daily calling records, call concurrency,
MIS file row counts, recording volume and retention are **OPEN capacity
inputs**. Before launch, KBS should approve measured acceptance
thresholds for OTP/login, customer queue, card lookup, MIS batch
processing, dashboard refresh and report search. Do not invent a 99.9%
SLA or numerical response-time guarantee without agreed load and cost
constraints.

## 24.3 Auditability and observability

Every accepted/rejected upload, mapping revision, lead reference
linkage, bank status change, Telecaller assignment/WFH grant, training
reactivation, payout decision and manual payment must have an
actor/time/source trace. Admin sees operational errors and unmatched
rows, not just successful totals. Avoid storing raw PII in logs. Backup
and restoration must preserve bank MIS provenance and payment proof
relationships.

## 24.4 File/document lifecycle

Validate Excel size/type/content, protect against malicious workbook
content, preserve source files and support safe retry. PDFs, cancelled
cheques, ID cards and payment proofs require content-type validation,
access controls and malware scanning. Recording/document downloads must
be restricted or disallowed according to role policy. Exact retention
and object-storage provider are implementation decisions subject to
approved legal/contract requirements.

## 24.5 Release quality

All critical flows must pass acceptance tests across Android and web,
including poor connectivity and authorization failures. Verify Android
secure-screen protection on supported device versions but clearly
document limits. Test browser/mobile accessibility, long/missing MIS
values, long bank decline reasons, varying bank headings, different
timezones/date formats and simultaneous payout submissions.
