<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 25. Role-specific screen inventory and navigation

## 25.1 Shared screens

OTP login; role-aware access error; profile/support/logout;
notifications with record deep-link; masked sensitive-data reveal only
under permission; session-expired recovery; no-connection/retry and
account-deactivated explanations. Each role returns to its own home
after successful OTP and prerequisite checks.

## 25.2 Telecaller Android screens

| **Screen**              | **Primary information/actions**                                                               | **Exit/next**                                             |
|-------------------------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------|
| Training landing        | Three modules, completion/checks, first-login deadline, current module, reason if deactivated | Active module or Manager reactivation message.            |
| Module learning         | Admin video, relevant learning material, progress                                             | MCQ assessment after configured prerequisites.            |
| MCQ result              | Correctness/score, pass threshold and retry availability                                      | Next module only after pass; queue after Module 3.        |
| My Calling Queue        | Assigned customers only; name, masked mobile, pincode/location, status, callbacks, Call/Open  | Customer calling desk.                                    |
| Customer / Calling Desk | Customer, sourceable cards, PDF, official ID, share link, in-app call, call state, remarks    | Save outcome; follow-up queue or hidden history.          |
| Card Detail in Call     | Bank/card, pincode/channel availability, benefits/fees, PDF/link                              | Return to live call context without losing call controls. |
| Interaction Detail      | All attempts, real recordings if available, shared material, operational remarks              | Continue safe permitted follow-up.                        |
| Follow-ups              | Due callback customers, latest operational note                                               | Open customer; reschedule/complete within policy.         |
| History / Hidden        | Completed/declined calling records permitted by own assignment                                | View; no deletion or suppressed recontact.                |
| Official ID             | Company identity card and revocation/validity information                                     | Share through authorized customer action.                 |

## 25.3 Manager mobile and web screens

Team overview; Create Telecaller; Telecaller
profile/training/deactivation/reactivation; WFH exception
administration; allocation and calls; customer operational
history/recording access; Advisor team and lead-MIS details; team
analytics; payout requests and approval detail; approval history;
notifications; profile/logout. Mobile may use smaller cards/filters; web
may use richer full-width data tables, but authorization and calculation
must be consistent.

## 25.4 Admin web screens

Executive dashboard; Managers/users/roles; Telecaller training content
and test configuration; customer calling Excel import/mapping/result;
allocation oversight; bank-specific pincode file import/mapping/result;
card catalogue/editor/PDFs/application links; MIS Excel
import/profile/preview/match/conflict/log; cross-role customers,
operational leads and Advisor applications; organization analytics by
source; telephony/WhatsApp delivery/recording oversight; network/WFH
policy; Agent Code/hierarchy management; payout rules (once approved),
payout approval and ledger; payment proofs; compliance/suppression;
audit and exceptions; notifications/account. The one Admin owner must
retain final business visibility, but sensitive-data read/export must be
audited.

## 25.5 Accounts web screens

Pending dual-approved payments; payout request detail with two approval
records; masked payee-bank details; manual payment record form; proof
upload/verification; paid ledger; payment exceptions;
notifications/profile. No status-edit control exists here.
