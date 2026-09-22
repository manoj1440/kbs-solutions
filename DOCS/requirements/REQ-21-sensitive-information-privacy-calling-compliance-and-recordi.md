<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 21. Sensitive information, privacy, calling compliance and recording safeguards

## 21.1 Data categories and minimization

Classify and restrict customer mobile, PAN, bank MIS/customer data,
Advisor Aadhaar verification evidence, bank account/cancelled cheque,
call recordings, application links with partner tracking, company ID
cards and payout proof. Do not store full Aadhaar numbers or raw offline
e-KYC packages/share codes by default. Mask PAN and bank account where
their full content is not necessary; avoid placing sensitive strings in
URLs, client logs, error traces, analytics events, notifications or
exports. Encrypt in transit and at rest; apply role-based document
access and protected delivery URLs with expiry where suitable.

## 21.2 Third-party purchased calling lists

KBS states it purchases customer data from third parties. **Purchase
alone is not sufficient evidence that a customer has consented to KBS
credit-card solicitation.** Before a batch is activated for calling,
require the relevant source/consent representations, approved
permitted-use basis, suppression/DND procedure,
calling-time/communication rules and vendor-provenance process to be
confirmed by KBS compliance. Store source and do-not-contact controls;
block or exclude records disallowed by approved policy. Official TRAI
guidance on commercial-communication sender obligations and customer
preferences is available at https://www.trai.gov.in/advice-to-senders
and https://www.trai.gov.in/tcccpr. Exact legal interpretation and
operational SOP must be approved for the actual campaign and telephony
provider.

## 21.3 Call recordings and communications consent

Use a compliant telephony route, give required disclosures, respect call
recording/customer consent rules and apply purpose-specific recording
access/retention. Automatic recording should be attempted on eligible
connected calls through the chosen provider; report recording failures
and never promise a recording exists if one does not. Store contact
opt-out and restrict further calling. WhatsApp consent/template
restrictions and document-delivery evidence must be respected as a
separate communication channel.

## 21.4 Aadhaar verification

An official UIDAI paperless offline e-KYC flow is a possible
verification pattern when permissible; verify the signed payload
according to UIDAI guidance and avoid unauthorized storage/share of
Aadhaar data. The precise Aadhaar verification mode/provider, whether
KBS is an eligible verification entity, consent, retention and audit
must be approved before launch. UIDAI reference:
https://uidai.gov.in/en/307-faqs/authentication/offline-aadhaar-data-verification-service.html.

## 21.5 Operational security requirements

OTP rate limits, session expiry/revocation, server-enforced RBAC,
authorization on every object/file/recording, app access policy, secure
document/object storage, upload malware scanning, audit logs, secret
handling and restricted exports are mandatory design concerns. Maintain
an authorized mechanism for deleting/restricting records under
applicable policy without silently deleting bank/payout audit trails
needed for legitimate obligations. **OPEN:** final data-retention
durations, records of consent, backup/restore targets, incident response
owners, acceptable document stores and precise compliance obligations
under KBS's contracts.
