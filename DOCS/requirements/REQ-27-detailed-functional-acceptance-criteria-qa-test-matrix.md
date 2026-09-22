<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 27. Detailed functional acceptance criteria / QA test matrix

The following tests are intended to become executable QA cases;
placeholders marked OPEN must be bound to KBS-approved values before
formal sign-off.

| **ID**   | **Scenario and expected result**                                                                                                                          |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| AUTH-01  | Every role signs in using registered mobile + valid OTP; password/email login is not required or offered.                                                 |
| AUTH-02  | OTP expiry, wrong code, resend and rate-limiting handled without exposing another account.                                                                |
| RBAC-01  | Telecaller sees own assigned customers only; Manager sees own team; Admin organization-wide; Advisor own leads; Accounts approved payout data only.       |
| RBAC-02  | Direct API/deep-link attempt to another user's lead, PAN, recording, cheque or proof is denied server-side.                                               |
| TRAIN-01 | Manager alone creates Telecaller with name/number; assigned Manager and company ID generated.                                                             |
| TRAIN-02 | First successful Telecaller login stores one 72-hour deadline; repeat login cannot reset it.                                                              |
| TRAIN-03 | All three video/MCQ modules must be passed in order before calling queue is accessible.                                                                   |
| TRAIN-04 | A Telecaller with incomplete module after 72 hours is deactivated and cannot access customer data.                                                        |
| TRAIN-05 | Assigned Manager reactivates failed Telecaller; next screen is first uncleared module; earlier passes persist.                                            |
| TRAIN-06 | Another Manager cannot reactivate a Telecaller outside their reporting team.                                                                              |
| CUST-01  | Admin imports sample headers NAME, PAN NO, MOBILE, Pincode; no nonexistent Location column is assumed.                                                    |
| CUST-02  | Uploaded records validated, duplicate/invalid/suppressed rows reported, accepted records assigned to eligible trained Telecallers.                        |
| CUST-03  | Reimporting same customer list does not erase prior assignment, do-not-contact or call history.                                                           |
| CUST-04  | Follow-up customer remains in active follow-up; completed/declined customer can be hidden without deletion.                                               |
| PIN-01   | All nine supplied bank sheet structures are importable via bank-specific profiles with original fields preserved.                                         |
| PIN-02   | Unknown sourcing flag does not create an automatically available card; pincode not found displays no supported sourceability, not personal ineligibility. |
| PIN-03   | Pincode match preserves zeros, respects bank/channel flags, displays linked Admin card details/PDF/URL when configured.                                   |
| CARD-01  | Advisor can browse/search/filter by issuer/category, open accurate benefits/fees/disclosures and select card.                                             |
| CALL-01  | Telecaller initiates call from app; actual provider result/call ID and duration when available are attached to correct customer.                          |
| CALL-02  | When recording exists it is playable by authorized Manager/Admin; recording failure never displays 'recorded'.                                            |
| CALL-03  | Card benefits, official ID, PDF, link and remarks remain reachable within the customer calling context.                                                   |
| WA-01    | PDF, official ID and card link are individually shareable; 'share sheet opened' is not called 'delivered'.                                                |
| WA-02    | Exact published URL and tracking parameters are preserved; link-sharing activity is recorded against customer/card.                                       |
| CALL-04  | Interest/follow-up/decline recorded as **operational** outcome and does not set bank final decision or activation.                                        |
| SEC-01   | Telecaller customer actions blocked outside approved office context unless valid WFH exception; Advisor offsite use remains allowed.                      |
| SEC-02   | Android app applies supported protected-screen controls; security test notes residual external capture limitations.                                       |
| FOS-01   | Advisor signs up by OTP/name/mobile/email and completes required identity/bank/cheque workflow under approved compliance rules.                           |
| FOS-02   | Valid Agent Code assigns correct parent; blank code maps to Admin; adding code later is available with explicit attribution policy.                       |
| FOS-03   | Advisor guided lead captures mobile, details, PAN, pincode/location, employment/ITR income, declarations and review.                                      |
| FOS-04   | Internal submission generates a KBS lead only; sharing an issuer link does not set bank 'Submitted', 'Approve' or activation.                             |
| FOS-05   | PAN verify mismatch, missing consent and invalid customer field produce editable errors, not a false completed lead.                                      |
| FOS-06   | Advisor sees own My Leads, search/filters/detail, and can always distinguish operational history from bank MIS history.                                   |
| MIS-01   | Admin MIS upload validates expected bank-specific mapping, rows and references and shows import-preview anomalies.                                        |
| MIS-02   | HDFC stage = Decisioned Cases, decision = Approve, activation = INACTIVE appear independently and verbatim.                                               |
| MIS-03   | HDFC Card Activation Staus = #N/A displays 'Not reported', with no activation payout eligibility inferred.                                               |
| MIS-04   | KBS lead not yet present in MIS displays 'Awaiting MIS Update', never a fabricated bank stage.                                                            |
| MIS-05   | Previous bank-matched lead missing in newest MIS retains last accepted values and its own last matching batch date.                                       |
| MIS-06   | Distinct original remarks from DROPOFF_REASON, DECLINE_DESCRIPTION, Decline Descreption, Decline Type, Reason etc. remain individually viewable.          |
| MIS-07   | Bank status cannot be edited from Telecaller, Advisor, Manager, Admin direct lead edit or Accounts workflows; only accepted MIS processing changes it.    |
| MIS-08   | Reupload identical MIS does not duplicate change history, notifications, activation event or payout.                                                      |
| MIS-09   | Unmatched/ambiguous references and contradictory duplicates are quarantined rather than guessed by customer name.                                         |
| MIS-10   | A valid later bank correction produces a new source-backed historical snapshot with reported date separated from upload time.                             |
| MIS-11   | Unknown bank values are preserved pending mapping; no silent Approve/Activated synonym guess.                                                             |
| VIEW-01  | Web table/mobile lead cards show distinct Stage, Decision, Activation, remarks and per-lead last matched MIS date.                                        |
| VIEW-02  | No fixed Lead Created -> Processing -> Approved timeline appears as a falsely bank-confirmed path.                                                      |
| VIEW-03  | Pending actions represent supported actual bank instructions or explicitly logged KBS tasks with source and owner if known.                               |
| DASH-01  | Calling attempts, links shared, operational leads, bank decisions and MIS activations are separate KPIs with date/source.                                 |
| DASH-02  | Manager team scope and Admin org scope yield consistent underlying totals when filtered to same population/time.                                          |
| PAY-01   | Approval/card setup without configured MIS payout event cannot create available payout entitlement.                                                       |
| PAY-02   | Eligible card selected in a submitted request is reserved; second session cannot claim it concurrently.                                                   |
| PAY-03   | Both Manager and Admin decisions exist before request appears in Accounts payment-ready queue.                                                            |
| PAY-04   | Admin-direct Advisor cannot bypass the independent Manager approval requirement.                                                                          |
| PAY-05   | Accounts records **external** transfer and uploads proof; KBS itself does not transfer money.                                                             |
| PAY-06   | Paid entitlement no longer claimable; MIS activation count/history unchanged; itemized card/request/payment trace exists.                                 |
| PAY-07   | Wrong amount, absent proof, double transaction reference and later MIS correction route to visible exceptions, not silent double payout.                  |
| NOTIF-01 | MIS status-change notification reports exact changed field/source time and deep-links only for authorized recipient.                                      |
| NOTIF-02 | Request approvals/payment notifications reach relevant Advisor/Manager/Admin/Accounts without leaking PAN or full bank account.                           |
| AUDIT-01 | User access changes, uploads, assignment, training reactivation, bank correction, each approval and payment retain source/actor/time.                     |
