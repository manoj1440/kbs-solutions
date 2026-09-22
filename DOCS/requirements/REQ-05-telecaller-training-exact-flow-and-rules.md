<!-- Source: KBS_Credit_Card_DSA_Complete_PRD.docx v1.0 (22 Sep 2026). This file is the VERBATIM requirement text for this section. Do not paraphrase away detail; engineering decisions live in DOCS/analysis and DOCS/decisions. -->

# 5. Telecaller training: exact flow and rules

## 5.1 Creation and commencement

Only a Manager creates a Telecaller using **name and mobile number**;
the system records the creator as assigned Manager and generates a
company ID card. On first successful OTP login, start a **72-hour
elapsed** training window and present Module 1. The deadline is the
first-login instant plus 72 hours, not three midnight boundaries or
three business days. Subsequent logins do not reset it.

## 5.2 Three sequential modules

Admin alone uploads/maintains the three modules, each including video
content and an MCQ-only assessment (the original 'videos + Q&A'
requirement). Each module is intended for the corresponding training
day, but passing is determined by module completion within the overall
72-hour window. Show training index, current module, video, questions,
assessment results, current score and deadline. Block access to Module 2
until Module 1 passes; block Module 3 until Module 2 passes; block the
customer calling queue until all three pass.

## 5.3 Passing logic

Calculate assessment marks from correct MCQ answers and the
Admin-configured passing threshold; do not guess a percentage or the
exact meaning of 'average' without a configured formula. A module marked
passed stays passed. Failed/unfinished current module remains current.
**OPEN:** exact per-module vs averaged score rule, retry frequency,
attempt limit, question shuffle and whether video completion is
mandatory before assessment; all must be Admin-configurable rather than
hard-coded without agreement.

## 5.4 Deadline and reactivation

If all three modules are not passed by the 72-hour deadline,
automatically deactivate the Telecaller and deny calling access. The
assigned Manager alone can reactivate them. On reactivation, return to
the **first failed or unfinished module**, preserving earlier passes; do
not restart from Module 1. Record original deadline, reactivation date,
Manager and reason. **OPEN:** duration of the new training window after
reactivation; it must be specified before production, rather than
silently granting another 72 hours or unlimited time.

## 5.5 Acceptance examples

A Telecaller passes Modules 1-3 within 72 hours and enters the queue; a
Telecaller finishing only Modules 1-2 at 72 hours is deactivated; on
Manager reactivation they resume Module 3; Telecaller training progress
and aggregate pass/fail counts are visible to the assigned Manager and
Admin.
