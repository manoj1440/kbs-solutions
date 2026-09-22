# F-306 Contact suppression (do-not-contact) enforcement

- Group: Telecaller ops · Status: **DONE** · Depends on: F-005, F-103
- PRD refs: REQ-06 §6.5 (preserve do-not-contact suppression), REQ-08 §8.6 (customer request not to be contacted enforced as suppression, including across new imports), REQ-21 §21.2 (suppression/DND procedure; block disallowed records), REQ-23 §23.2, INV-07, gap analysis A6

## Detailed requirements
1. `ContactSuppression` keyed on E.164 mobile; reasons `CUSTOMER_REQUEST` (created from a call outcome with `doNotContact=true`), `COMPLIANCE` (Admin), `DND_LIST` (Admin bulk upload of a DND list — CSV of mobiles).
2. Effects: existing calling records for that mobile → `suppressed=true`, hidden from active queue (not deleted); new imports → row `EXCLUDED reason=SUPPRESSED`; `POST /calls` refuses `CALLING_SUPPRESSED`; share actions refuse.
3. Lifting requires Admin with reason (audited); history retained.
4. Admin screen: suppression list (masked mobiles, reason, source, actor), bulk upload, lift dialog.

## Acceptance criteria
- [x] Telecaller marks "customer asked not to be contacted" → suppression created; a later import of the same mobile is excluded; call initiation refused server-side.
- [x] Suppression never deletes the calling record or its history (INV-07 test).

## Progress notes
- 2026-09-22 (session 2): `GET/POST /suppressions`, `POST /suppressions/import` (DND CSV/XLSX via files module), `POST /suppressions/:id/lift` (reason, audited). Suppressing hides existing calling records (`suppressed=true`, hiddenAt) and is checked at import (F-303) and call initiation (F-309). Admin web page `/admin/compliance`. e2e `suppression-pincode.e2e-spec.ts`.
