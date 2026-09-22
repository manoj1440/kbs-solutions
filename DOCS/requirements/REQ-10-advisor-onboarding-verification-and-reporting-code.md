<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 10. Advisor onboarding, verification and reporting code

## 10.1 Signup steps

Public Advisor registration -> mobile entry -> OTP verification ->
name and email -> identity-verification consent/instructions ->
official Aadhaar verification through an authorized permissible method
-> bank-account details -> cancelled-cheque upload -> optional Agent
Code -> review/submission -> account available when mandatory
review/verification is complete. Only name, mobile and email are
mandatory personal profile fields explicitly specified by KBS; exact
bank field validation and verification provider contract are **OPEN**.
Record user consent before collection/verification and display the
privacy notice.

## 10.2 Aadhaar and verification safeguards

The verification must be authentic and compliant; do **not** presume KBS
is entitled to use an online Aadhaar authentication API merely because a
vendor offers one. Supported lawful options may include consent-based
UIDAI paperless offline e-KYC/QR verification or a properly authorized
partner route, to be selected after legal/provider review. Where offline
verification is used, verify signed evidence and retain only minimum
permitted evidence/results under approved policy, never casually log a
full Aadhaar number, XML/share code or Aadhaar image. Reference: UIDAI
offline verification guidance at
https://uidai.gov.in/en/307-faqs/authentication/offline-aadhaar-data-verification-service.html.
**OPEN:** exact legal role of KBS, provider eligibility, permitted
workflow, storage/retention and user-consent wording.

## 10.3 PAN and bank information

Advisor onboarding must securely collect bank details for external
manual payouts and allow a cancelled-cheque file; PAN verification
appears in the **customer lead** journey. If KBS also requires Advisor
PAN or payout-bank verification, that is a separate **OPEN** onboarding
requirement rather than an assumed field. Mask account numbers in
ordinary views; limit full bank-details access to authorized personnel,
and log privileged access. Keep verification result, request/reference
and failure/retry states distinct from bank MIS card status.

## 10.4 Agent Code and ownership

Advisor may enter an Agent Code during signup or later in Profile. A
valid code assigns the Advisor to its mapped person/Manager; empty code
assigns the Advisor directly under the sole Admin. Show the resulting
reporting person to the Advisor, Admin and appropriate Manager. Reject
an unknown/revoked code with a clear message and preserve a pending/none
result rather than assigning it to a random Manager. **OPEN:** code
format, whether a code can point to anyone other than Manager/Admin,
code expiry, repeated code changes, reparenting approval, and effective
date for future vs historical leads/payouts. These policies must be
resolved explicitly to prevent payout attribution changes.
