<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 22. Conceptual data model and ownership (requirements, not database design)

| **Business entity**           | **Minimum relationships/data**                                                                                          | **Authoritative input**                                 |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------|
| User / Role                   | Mobile, role, enabled state, authentication/security history                                                            | KBS account administration / signup.                    |
| Reporting assignment          | Advisor Agent Code, Manager/Admin parent, effective date/history                                                        | Approved KBS hierarchy policy.                          |
| Training enrollment           | Telecaller, first login, original deadline, modules, scores/pass history, reactivation                                  | KBS training activity and Admin content.                |
| Customer calling record       | Source row/batch, customer name/mobile/pincode/PAN-restricted, Telecaller assignee, suppressed/hidden status            | Admin-uploaded customer list + KBS allocation.          |
| Card / product / link         | Bank, product code, published description, pincode/channel sourcing, fees, PDF, application URL/version                 | Admin card catalogue and bank pincode uploads.          |
| Call / operational activity   | Telecaller, customer, call/provider ID, actual call result, recording, remarks, share actions                           | In-app activity + telephony/WhatsApp provider results.  |
| Advisor lead                  | Advisor, customer consent/details, card, KBS lead ID, own application-link activity, reporting parent snapshot          | KBS Advisor flow.                                       |
| Bank application linkage      | Bank, confirmed issuer application number/reference, KBS lead, match verification                                       | Reliable bank reference and approved linkage.           |
| Bank MIS batch / row          | Bank/profile, immutable file, uploader/times, original row/fields, match/conflict outcome                               | Admin-uploaded bank MIS.                                |
| Reported bank status snapshot | Current stage, final decision, KYC substatuses, activation, bank reasons, source row and last matched batch             | **Only accepted matching MIS row**.                     |
| MIS change history            | Old/new raw field values, source batch/time, bank event date if present                                                 | Accepted MIS update processing.                         |
| Payout entitlement            | Advisor/lead/card payable event, approved bank-specific trigger, rate version, eligibility and reservation/paid history | MIS evidence + approved KBS commercial policy.          |
| Payout request/approvals      | Selected entitlements, amount, Manager and Admin decisions, audit                                                       | KBS dual-approval workflow.                             |
| External payment              | Accounts operator, transfer reference/date/amount, proof, request linkage                                               | Accounts-recorded external payment evidence.            |
| Notification / audit          | Intended recipient/record/event, event source, read/time, actor/change reason                                           | KBS events with MIS source reference where appropriate. |

## 22.1 Separation constraints

Customer calling records, Advisor leads, bank MIS rows and payout
entitlements are separate entities even when they mention the same
human/card. No accidental one-to-one assumption: a person may have
multiple bank applications, a bank reference must match an
issuer-specific application, and an Advisor may have multiple card
entitlements. Reporting parent changes and card/payment settlements need
effective-dated history. File versions, status snapshots and payment
snapshots must be reproducible from audit evidence without exposing raw
PAN/Aadhaar in normal UI.
