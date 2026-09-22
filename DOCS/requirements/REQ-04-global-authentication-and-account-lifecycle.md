<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 4. Global authentication and account lifecycle

## 4.1 OTP-only authentication

Every role logs in by registered mobile number plus OTP; do not
introduce password/email login as an alternative. Advisor uses the same
mobile/OTP flow to begin signup. Login validates role, activation,
training gate, network restrictions (where applicable),
verification/onboarding completion and session policy before presenting
the role's home screen. All OTP codes must expire, be rate-limited and
never be stored or shown in plaintext after verification. Lost/changed
phone ownership and number reassignment require an Admin-reviewed
recovery process; **OPEN:** specific recovery policy and OTP provider
contract.

## 4.2 Role-dependent first login

> **•** Telecaller: OTP -> mandatory training or failed/deactivated
> explanation; no calling queue before successful training.
>
> **•** Advisor: OTP -> personal details, identity verification,
> payout-bank details and optional Agent Code -> available Advisor home
> when allowed by onboarding policy.
>
> **•** Manager: OTP -> team workspace on mobile or web.
>
> **•** Admin: OTP -> organization-wide dashboard and controls.
>
> **•** Accounts: OTP -> payout queue and payment records.

## 4.3 User lifecycle

Maintain account creation, active, blocked/deactivated and reactivated
events with who/when/why. Preserve assignment history, completed
training, activity and payout records when status changes. Do not let
deactivation erase existing MIS or audit history. **OPEN:** exact
Manager/Advisor/Accounts suspension and recovery authority,
account-retention period and concurrent-session rules.
