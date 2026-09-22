<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 12. Corrected 29-screen FOS experience map

The original FOS draft lists 29 conceptual screens. Preserve their
functional coverage but interpret S21-S27 according to the **MIS-only
bank-status rule**. The product may combine adjacent screens for an
intuitive UI as long as all required information and actions remain
available. No visual screen sequence is authority to change bank status.

| **Original screen**             | **Required experience and correction**                                                                                          |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| S01 Welcome / Onboarding        | KBS branding, introduction, Skip/Next; no approval promises.                                                                    |
| S02 Credit Card Product Range   | Bank/NBFC branding and Admin-published credit card range.                                                                       |
| S03 Digital Selling             | Explain digital customer lead creation, issuer-link initiation and MIS-based tracking.                                          |
| S04 Credit Card Promotion       | Approved marketing content; no guaranteed approval.                                                                             |
| S05 Sell More, Earn More        | Advisor value proposition and Get Started without inventing payout rates.                                                       |
| S06 Mobile Number               | Advisor mobile entry, privacy/terms/consent.                                                                                    |
| S07 OTP Verification            | OTP, masked number, resend/edit and validated expiry; exact digit count and timer are implementation choices unless configured. |
| S08 Credit Card Home            | Cards, Create Lead, My Leads, actual Pending Actions, notifications, payout links.                                              |
| S09 Credit Card Catalogue       | Cards with image, bank, key benefits and fee highlights.                                                                        |
| S10 Credit Card Categories      | Travel, Shopping, Premium/Top, Fuel and configured categories.                                                                  |
| S11 Card Search and Filters     | Search issuer/card and meaningful business filters.                                                                             |
| S12 Credit Card Details         | Image, issuer, benefits, fees, disclosures, available Admin link, Create Lead.                                                  |
| S13 Customer Mobile             | New operational lead begins with customer's mobile number.                                                                      |
| S14 Customer Details            | Required basic information, correction and validation.                                                                          |
| S15 PAN                         | PAN capture and actual verification result; avoid unnecessary exposure.                                                         |
| S16 Pincode / Location          | Residence pincode with verified city/state or 'unavailable'.                                                                    |
| S17 Employment / Income         | The three specified employment types and annual income as per ITR.                                                              |
| S18 Declarations                | Explicit required declarations and Credit Bureau acknowledgement.                                                               |
| S19 Review and Submit           | Accurate summary; back/edit before submitting internal lead.                                                                    |
| S20 Lead Created                | KBS reference and next step; no implied bank submission/decision.                                                               |
| S21 Eligibility / Card Result   | Only genuinely available confirmed sourcing/eligibility; no inferred result.                                                    |
| S22 Application Initiation      | Share/open chosen issuer link; record only KBS operational action, not a bank-reported stage.                                   |
| S23 Pending Actions             | Display real MIS-supported or explicitly logged operational tasks, never fabricated tasks.                                      |
| S24 My Credit Card Leads        | Show separate real bank stage, decision, activation, bank remarks and MIS date.                                                 |
| S25 Lead Search and Filters     | Customer/reference search; card, bank, stage, decision, activation, date filters.                                               |
| S26 Lead Detail                 | Bank MIS current values and separate operational history; next action only if supported.                                        |
| S27 Application / Lead Timeline | **Replace old fixed progression** with chronological MIS updates and separate KBS activity log.                                 |
| S28 Notifications               | MIS changes, genuinely actionable tasks, payout updates and company notices.                                                    |
| S29 FOS Profile                 | Profile, reporting code, payout/bank summary, support and logout.                                                               |
