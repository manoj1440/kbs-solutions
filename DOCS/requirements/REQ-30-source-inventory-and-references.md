<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 30. Source inventory and references

## 30.1 User-supplied business sources

> **1.** Pasted text.txt — original KBS role/workflow descriptions,
> original FOS 29-screen narrative and subsequent decisions superseding
> several earlier ideas.
>
> **2.** offline_cards_20_jaipur_pincodes(1).xlsx — customer calling
> sample; headings NAME, PAN NO, MOBILE, Pincode; no separate Location
> heading.
>
> **3.** 10_records_each_bank(1).xlsx — nine bank-specific pincode
> worksheet examples; bank-specific headers and flags, not a complete
> card catalogue or activation MIS.
>
> **4.** KBS804%20HDFC%20MIS_recreated(1).xlsx — HDFC example with 36
> exact headers, separate CURRENT_STAGE, FINAL_DECISION, Card Activation
> Staus, KYC and bank reason columns.
>
> **5.** Two original user-supplied partner URLs listed in Section 7.5;
> use only after Admin associates each with an approved
> bank/card/channel and confirms current validity.

## 30.2 External implementation/compliance references (not additional business requirements)

> **•** Official shadcn/ui docs and web component model:
> https://ui.shadcn.com/docs and monorepo guidance
> https://ui.shadcn.com/docs/monorepo.
>
> **•** React Native shadcn-style registry example (independent project;
> evaluate suitability rather than silently mandate):
> https://reactnativereusables.com/docs/changelog.
>
> **•** UIDAI paperless offline e-KYC guidance:
> https://uidai.gov.in/en/307-faqs/authentication/offline-aadhaar-data-verification-service.html.
>
> **•** TRAI commercial communication sender guidance:
> https://www.trai.gov.in/advice-to-senders and
> https://www.trai.gov.in/tcccpr.
>
> **•** Android playback/capture restrictions and protected-screen
> context: https://developer.android.com/media/platform/av-capture.

**End of complete PRD.** The OPEN items are explicit, necessary
production decisions; they are not permission to abandon or replace any
of the confirmed KBS workflows or the single-source-of-truth MIS rule.
