<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 3. Roles, permissions and hierarchy

## 3.1 Role definitions

| **Role**              | **Account origin**                                                  | **Data access**                                             | **Main responsibilities**                                                                                                                                        |
|-----------------------|---------------------------------------------------------------------|-------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Admin (company owner) | One company-owner Admin                                             | Organization-wide                                           | All configuration, imports, card content, training, users, teams, analytics, MIS review, payout approval and audit.                                              |
| Manager               | Authorized organizational creation (exact creation permission OPEN) | Own reporting team; broad Admin-approved operational scope  | Create and supervise Telecallers, reactivate training, WFH exceptions, oversee assigned Advisors, review metrics/recordings and approve payouts. Mobile and web. |
| Telecaller            | **Manager only**                                                    | Own assigned calling customers and own operational activity | Complete training; call from app; see pincode cards; share WhatsApp material; record outcomes, follow-up and links. Monthly salary, no card-based payout claim.  |
| Advisor / FOS         | Self-register through app                                           | Own leads, own eligible cards/payouts; own profile          | Identity/bank onboarding, choose card, capture customer details, initiate/share issuer link, review bank MIS status, request payouts.                            |
| Accounts              | Authorized organizational creation (exact creator OPEN)             | Approved payout data and required payee details             | Review approved payment queue, make payment **outside** the application, record payment reference and upload proof. No bank-status edits.                        |

## 3.2 Reporting relationships

A Manager-created Telecaller is assigned to that Manager and cannot see
another Manager's records. An Advisor enters an Agent Code during signup
or later; a valid code attaches the Advisor to its designated
person/Manager. If code is blank, the Advisor belongs under the Admin.
The Advisor's applications and activated-card results are attributed
through that reporting hierarchy. **OPEN:** whether changing/adding an
Agent Code after prior lead creation changes historical lead/payout
attribution, and how an Admin-direct Advisor receives the mandatory
Manager payout approval. Neither rule can be silently presumed;
historical attribution must remain auditable.

## 3.3 Permission safeguards

Permission enforcement must occur server-side as well as in UI, scoped
to organization, reporting line, assignment and record type. A Manager
cannot access unrelated teams, a Telecaller cannot pull the entire
imported customer list, an Advisor cannot see another Advisor's PAN/bank
details, and Accounts cannot alter the MIS. Admin access to sensitive
data must be limited to legitimate function even though Admin has
organization-wide business visibility. Capture
access/edit/export/download activity for sensitive records where
technically feasible.
