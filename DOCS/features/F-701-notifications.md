# F-701 Notifications: outbox fan-out, in-app centre, push, dedupe, deep links

- Group: Dashboards & notifications · Status: **IN_PROGRESS** · Depends on: F-110, F-109, F-102
- PRD refs: REQ-19 §19.1 (mandatory per-role list), §19.2 (cite raw field changed and batch date; never 'approved/activated' unless the configured field supports it; dedupe identical imports; scope by ownership; deep link with re-check; push provider OPEN), REQ-14 §14.6 (wording), REQ-21 §21.1 (no PAN/full account in notifications), REQ-12 S28
- QA ids: NOTIF-01, NOTIF-02

## Detailed requirements
1. Event → recipients resolver per kind (Telecaller/Manager/Advisor/Admin/Accounts lists from §19.1) using current hierarchy; `dedupeKey` (e.g. `mis.lead.changed:<leadId>:<batchId>`) unique → identical imports produce nothing new.
2. Wording templates: MIS change → "Bank MIS updated (batch KBS-B-…, 22 Sep): Final decision = Approve; Card activation = INACTIVE" listing only changed raw fields; activation wording "Card activation reported as <raw>" only when the field is `cardActivationStatus`; "payout eligible" only when F-602 created an entitlement.
3. `GET /notifications`, `POST /notifications/:id/read`, unread count; deep link `{entityType, entityId}` → client navigates then fetches; server re-checks scope at fetch (revoked ownership → NOT_FOUND).
4. Push via `PushProvider` (Expo push tokens registered per session); body never includes PAN/account/mobile.
5. Web notification drawer; mobile S28 list.

## Acceptance criteria
- [ ] NOTIF-01: MIS change notification names exact field/value/batch; sent only to the owning Advisor, their Manager, Admin.
- [ ] NOTIF-02: approval/payment notifications contain no PAN/account digits (regex test on rendered bodies).
- [ ] Re-applied identical batch → zero new notifications.
