<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 23. Error states, conflicts and recovery paths

## 23.1 Authentication and access

OTP incorrect/expired/rate-limited; disabled account; Telecaller
training overdue; Telecaller outside approved office network without WFH
permission; Manager/Advisor moved teams; denied document access; session
invalidated. Show a clear role-appropriate message and a valid recovery
action without revealing whether an unrelated phone number/customer
exists.

## 23.2 Training and queue

Video unavailable; submission interrupted; wrong/insufficient MCQ score;
72-hour deadline reached during assessment; Manager tries to reactivate
a Telecaller outside their team; no eligible assignees on upload;
duplicate customers; customer requests no further contact; previous
record hidden then reappears in new purchased batch. Preserve
progress/history; fail closed on access; do not erase suppression.

## 23.3 Calling and sharing

Provider busy/offline, call never connected, callback required,
recording denied/failed, WhatsApp not installed or customer hasn't
consented, PDF missing, expired company ID, revoked bank link, no
pincode mapping. The UI must report what is known and prevent a
misleading 'Call completed', 'Recorded', 'PDF delivered' or 'Customer
eligible' success badge.

## 23.4 Lead initiation and MIS

Issuer website opens but no application reference returns; KBS lead
submitted twice; customer corrects PAN; pincode maps to no issuer; MIS
has unexpected header, conflicting duplicate bank reference, unknown
status, an absent old lead, a stale earlier batch or #N/A activation.
Preserve separate operational and bank status; quarantine conflicts; use
'Awaiting MIS Update' or 'Not reported' as appropriate; keep prior
accepted status with its actual freshness label.

## 23.5 Payout exceptions

Simultaneous claims on same eligible card; request awaiting one of two
approvals; request rejected; Advisor directly under Admin (no assigned
Manager); paid request with missing proof; external transfer amount
differs; rate adjusted after request; bank MIS corrects a previously
reported activation. Hold ambiguous payments for Admin/Accounts review;
don't double-pay or silently reverse history. Any additional
compensating-payment/clawback process requires a later, separately
agreed scope.
