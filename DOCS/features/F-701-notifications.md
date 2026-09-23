# F-701 Notifications: outbox fan-out, in-app centre, push, dedupe, deep links

- Group: Dashboards & notifications · Status: **DONE** · Depends on: F-110, F-109, F-102
- PRD refs: REQ-19 §19.1 (mandatory per-role list), §19.2 (cite raw field changed and batch date; never 'approved/activated' unless the configured field supports it; dedupe identical imports; scope by ownership; deep link with re-check; push provider OPEN), REQ-14 §14.6 (wording), REQ-21 §21.1 (no PAN/full account in notifications), REQ-12 S28
- QA ids: NOTIF-01, NOTIF-02

## Detailed requirements
1. Event → recipients resolver per kind (Telecaller/Manager/Advisor/Admin/Accounts lists from §19.1) using current hierarchy; `dedupeKey` (e.g. `mis.lead.changed:<leadId>:<batchId>`) unique → identical imports produce nothing new.
2. Wording templates: MIS change → "Bank MIS updated (batch KBS-B-…, 22 Sep): Final decision = Approve; Card activation = INACTIVE" listing only changed raw fields; activation wording "Card activation reported as <raw>" only when the field is `cardActivationStatus`; "payout eligible" only when F-602 created an entitlement.
3. `GET /notifications`, `POST /notifications/:id/read`, unread count; deep link `{entityType, entityId}` → client navigates then fetches; server re-checks scope at fetch (revoked ownership → NOT_FOUND).
4. Push via `PushProvider` (Expo push tokens registered per session); body never includes PAN/account/mobile.
5. Web notification drawer; mobile S28 list.

## Acceptance criteria
- [x] NOTIF-01: MIS change notification names exact field/value/batch; sent only to the owning Advisor, their Manager, Admin.
- [x] NOTIF-02: approval/payment notifications contain no PAN/account digits (regex test on rendered bodies).
- [x] Re-applied identical batch → zero new notifications.

## Progress notes
- **Delivery model (decision):** fan-out happens synchronously right after the owning transaction commits, through `NotificationsService.notify/notifyMany`, deduplicated by a unique `dedupeKey` per recipient; the outbox events stay the durable record for downstream consumers. Re-applying an identical MIS batch yields no changed leads and the same keys, so zero new notifications (asserted in `mis-apply.e2e-spec.ts`).
- **Recipients:** `leadAudience(leadId)` = owning Advisor + their *current* Manager (only if the parent is a Manager) + Admin; `chainOf(userId)` for Telecaller/Advisor → Manager/Admin. Existing per-feature recipients (training, payouts, onboarding, calling) unchanged.
- **Wording (`@kbs/shared` `misChangeBody`/`misChangeLine`):** "Bank MIS updated KBS-L-… (batch KBS-M-…, 23 Sept 2026): Final decision = \"Approve\"; Card activation reported as \"INACTIVE\"" — only changed raw fields, bank values quoted verbatim, activation always "reported as"; first match → `MIS_MATCHED` "matched in bank MIS"; blank/#N/A values are not claimed as changes.
- **New events:** `MIS_MATCHED`, `WFH_GRANTED` / `WFH_REVOKED` (Telecaller + Manager), `SECURITY_EVENT` to Admin on OTP lock (known accounts only; mobile masked).
- **Privacy (NOTIF-02):** every title/body passes `scrubSensitiveText` (PAN → masked, 9+ digit runs → last 4, Indian mobiles → `+91••••••1234`) before storage or push; `containsSensitive` is the test oracle.
- **Endpoints:** `GET /notifications?unreadOnly`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/:id/target` (marks read, re-checks scope now: Lead, PayoutRequest, MisImportBatch, User, CallingRecord; out of scope → 404), `POST /notifications/push-devices {token, platform}`, `DELETE /notifications/push-devices/:token`.
- **Push:** `PushDevice` table; `PUSH_PROVIDER=mock|expo` (`ExpoPushAdapter`, optional `EXPO_ACCESS_TOKEN`) — provider choice remains OPEN (REQ-19 §19.2). One push per new row, `pushedAt` recorded; logout, deactivation and Telecaller single-session login revoke devices. **Follow-up:** the mobile app does not yet obtain an Expo push token — add `expo-notifications` with the next native build (F-906) and call `POST /notifications/push-devices` after login.
- **Web:** `NotificationBell` in the Admin shell header and the shared role shell (Manager/Accounts): unread badge polled every 60 s, drawer, mark all read, click → `/target` re-check → role route. Browser-checked (3 unread → drawer → payout request opened).
- **Mobile:** `notifications` screen for Advisor (bell on Home), Manager and Telecaller (Profile → Notifications); tap re-checks then opens lead / payout request / telecaller / calling record.
- **Tests:** `notifications.e2e-spec.ts` (scrub + push + dedupe, read state, deep-link re-check after reassignment, WFH + OTP-lock security event, logout revokes device), `mis-apply.e2e-spec.ts` (NOTIF-01 recipients and wording, identical re-apply), shared `notification-text.test.ts`.
