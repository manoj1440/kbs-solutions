<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 19. Notifications and in-app event routing

## 19.1 Mandatory notifications

> **• Telecaller/Manager:** new assignment, training
> deadline/deactivation/reactivation, WFH grant/revocation, assigned
> follow-up due, call recording available/failure if operationally
> relevant.
>
> **• Advisor:** onboarding/verification issue, lead operational
> confirmation, new MIS match, actual MIS decision/stage/activation
> changes, bank-reported actionable issue, payout submission,
> Manager/Admin approval/rejection and Accounts payment confirmation.
>
> **• Manager:** Telecaller training exceptions, team operational items,
> Advisor request requiring Manager approval and resulting payment
> updates.
>
> **• Admin:** import completed/failed/unmatched/conflicted, bank
> mapping anomalies, company metrics where configured, Advisor request
> requiring Admin approval, payment exception and privileged-security
> event.
>
> **• Accounts:** request enters payment queue **only after both
> approvals**, request/payment exception and pending proof.

## 19.2 Event semantics

An MIS alert cites which raw reported field changed and the date of the
accepted matching batch; it must not say 'approved/activated' unless the
specific relevant MIS field and configured rule support that claim.
Deduplicate repeated identical imports and restrict recipient scope by
ownership/hierarchy. A notification should deep-link to the correct
authorized record; after ownership change or revocation,
permission-check again before showing content. **OPEN:** push provider,
expiry, customer-visible notifications (not requested) and escalation
policy.
