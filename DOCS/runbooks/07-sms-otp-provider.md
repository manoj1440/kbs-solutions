# SMS OTP provider — MSG91 (ADR-009)

How to turn on real login codes by SMS. Until this is done the API can only print codes to its own log
(`OTP_PROVIDER=console`), which production refuses, so nobody can log in to a production deployment.

**Status: code complete and unit-tested against a stubbed HTTP client. No SMS has ever been sent through it** — there was
no MSG91 account when it was written. Treat the first live send (step 5) as the real test. See "Not verified" at the end.

**Provider choice.** REQ-19 leaves the SMS provider OPEN and no document recorded a choice, so MSG91 was picked as the
engineering default (Indian provider, DLT-aware, plain HTTPS API). KBS should confirm it. Swapping later means one new
adapter behind the same `OtpProvider` port; nothing in the auth module changes.

## What the code does
- KBS generates the 6-digit code, stores only its hash, and enforces expiry, resend cooldown, attempt limit and lock
  (`apps/api/src/modules/auth/auth.service.ts`). MSG91 only delivers the text. MSG91's own "SendOTP / Verify OTP" product
  is **not** used.
- One request per code, no automatic retry, 10 s timeout:

  ```
  POST https://<MSG91_HOST>/api/v5/flow
  authkey: <MSG91_AUTH_KEY>
  content-type: application/json
  accept: application/json

  { "template_id": "<MSG91_TEMPLATE_ID>", "sender": "<MSG91_SENDER_ID>", "short_url": "0",
    "recipients": [ { "mobiles": "91XXXXXXXXXX", "<MSG91_OTP_VARIABLE>": "<code>" } ] }
  ```
- Success is HTTP 2xx **and** `{"type":"success","message":"<request id>"}`. Anything else (including HTTP 200 with
  `"type":"error"`) is a failure: the user sees "We could not send the code. Please try again in a moment." and the API log
  gets one `[msg91] not sent to +91••••••1234: …` line with the provider's reason. The log never contains the code, the full
  number or the auth key.
- Adapter: `apps/api/src/providers/adapters/msg91-otp.adapter.ts`; boot validation: `apps/api/src/config/env.ts`.

## 1. Outside the code — what the owner must do
1. **Create an MSG91 account** (https://msg91.com), complete its KYC and add SMS credit.
2. **DLT registration** (TRAI rule: without it Indian operators drop the SMS). On any one operator's DLT portal (Jio,
   Airtel, Vi or BSNL — one registration works for all):
   1. Register KBS as a **Principal Entity** (business PAN/GST documents). You get an Entity ID.
   2. Register a **Header** (sender id): 6 letters, e.g. `KBSSOL`.
   3. Register a **content template** for that header. OTP templates of non-bank businesses normally go under
      "Service Implicit" — pick what the portal offers for OTP. Register exactly this text:

      ```
      {#var#} is your KBS Solutions login code. It is valid for 5 minutes. Do not share it.
      ```
      You get a DLT Template ID once it is approved.
3. **In MSG91**: add the Entity ID and the approved header (sender id), then create an SMS template (SMS → Templates) with
   that sender id, the DLT Template ID, and this text — the variable must be named `VAR1`:

   ```
   ##VAR1## is your KBS Solutions login code. It is valid for 5 minutes. Do not share it.
   ```
   Copy the **template id MSG91 shows for it** (a 24-character id). That, not the DLT number, is `MSG91_TEMPLATE_ID`.
4. **Create an auth key** in MSG91 for this API. If MSG91 offers an IP allow-list for the key, either leave it off or add
   the API host's outbound IPs.

"5 minutes" is the real expiry: `auth.otp.expirySec` defaults to 300. It is an Admin-editable setting — if it is ever
changed, the DLT template and the MSG91 template must be re-registered with the new number, otherwise the SMS lies.

## 2. Environment variables on the API host (names only — values live in the host's secret store)
| Variable | Required | Meaning |
|---|---|---|
| `OTP_PROVIDER` | yes | `msg91` |
| `MSG91_AUTH_KEY` | yes | the auth key from step 4 (secret) |
| `MSG91_TEMPLATE_ID` | yes | MSG91's id of the template from step 3 |
| `MSG91_SENDER_ID` | yes | the DLT header, e.g. `KBSSOL` |
| `MSG91_OTP_VARIABLE` | no | variable name in the MSG91 template, default `VAR1` (case-sensitive) |
| `MSG91_HOST` | no | default `control.msg91.com`; host name only, no `https://` |

With `OTP_PROVIDER=msg91` the API **refuses to start** in every environment if any of the three required keys is missing
(`OTP_PROVIDER=msg91 needs …`). `scripts/release-check.mjs` checks the same three keys in the env file it is given.

On Render the three keys are already declared in `render.yaml` (`sync: false` — fill them in the dashboard). `OTP_PROVIDER`
is pinned to `console` in that file: change that line to `msg91` (commit + deploy) only after the keys are filled.

`OTP_DEV_MASTER_CODE` is unchanged: forbidden in production, must be a non-guessable code in staging. Once SMS works on
staging, clear it there too so testers log in with real codes.

## 3. First live test (one number)
1. Use a number you hold that already has a user in that environment.
2. Set the variables, deploy, confirm the API started (a missing key stops the boot with the message above).
3. Request a login code for that number from the app or web.
4. Expect: SMS within seconds with the registered text; API log has `[msg91] accepted for +91••••••NNNN (request <id>)`.
   Enter the code and log in.
5. If no SMS arrives but the log says `accepted`: open MSG91 → SMS logs, find the request id and read the delivery status
   (DLT mismatches show up there, not in the API response). Typical causes: template text differs from the DLT text by even
   one character, wrong sender id, the variable is not named `VAR1`, entity/header not yet linked in MSG91.
6. If the log says `not sent … HTTP 401`: wrong auth key, or the key's IP allow-list blocks the host.
7. Also try once: wrong code (rejected), Resend before the cooldown (refused), Resend after it (new SMS).

## 4. Switch back to console
Set `OTP_PROVIDER=console` and redeploy. The `MSG91_*` values can stay; they are ignored. Remember that
`NODE_ENV=production` never sends with `console` — on staging, login then needs `OTP_DEV_MASTER_CODE` again.

## Not verified (no provider account, no live send)
- That MSG91 accepts this exact request for a real account, and what a real success/failure body looks like beyond the
  documented examples.
- `sender` in the body: the current "Send SMS" spec does not list it (the sender is bound to the template); MSG91's older
  flow document lists it as a parameter. It is sent, and must equal the template's own sender id. If MSG91 rejects the
  field, remove it in the adapter (one line).
- `realTimeResponse` (listed as optional, meaning undocumented) is not sent. So an "accepted" answer means queued by
  MSG91, not delivered; DLT rejections appear only in MSG91's SMS logs.
- The variable naming convention (`##VAR1##`) and where exactly the template id is shown in today's MSG91 dashboard.
- The DLT steps and the "Service Implicit" category are general practice, not checked against a live portal.
- Delivery time, behaviour for DND numbers, and any MSG91 rate limit.
- Known app behaviour to be aware of (auth module, unchanged here): a failed send still starts the resend cooldown, and the
  client receives the generic error code `INTERNAL` (HTTP 500) because no dedicated "could not send" code exists yet.

## Documentation relied on (read 2026-11-11)
- Send SMS (flow API) OpenAPI spec: https://docs.msg91.com/sms/send-sms.openapi.yml (page: https://docs.msg91.com/sms/send-sms)
- Add Template (shows `sender_id` and `dlt_template_id` belong to the template): https://docs.msg91.com/sms/add-flow.openapi.yml
- SendOTP spec, read to decide **against** it (mobile and code travel in the query string, MSG91 stores the code): https://docs.msg91.com/otp/sendotp.openapi.yml
- Older flow document (`sender` parameter, error body `{"type":"error","message":…}`): https://control.msg91.com/apidoc/textsms/send-sms-flow.php
