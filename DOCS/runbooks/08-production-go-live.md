# Production go-live — what is left outside the code

The code paths are built and tested against mocks and a local/staging stack. Going live needs the items below, in this
order. Nothing here can be done from the repository alone: each needs an account, a decision or a device.
`pnpm release:check -- --profile=production` is the gate — it must exit 0 against the production API and env file.

## 1. Providers (accounts KBS must open)
| What | Why it blocks launch | Code status | Do this |
|---|---|---|---|
| SMS for OTP | With `OTP_PROVIDER=console` codes only appear in the server log; nobody can log in | MSG91 adapter built, unit-tested against a stub, **never sent a real SMS** | Runbook 07: MSG91 account, DLT entity + header + template, set `MSG91_*`, then `OTP_PROVIDER=msg91`; test with one number. Remove `OTP_DEV_MASTER_CODE` |
| Calling + recording | Call desk uses `TELEPHONY_PROVIDER=mock` | Exotel click-to-call adapter built; the trial account refuses calls until Exotel KYC is complete | Finish Exotel KYC (or choose another provider), set `EXOTEL_*`, `TELEPHONY_PROVIDER=exotel`; make one real two-number call and play the recording as Manager |
| Advisor identity (Aadhaar offline KYC) | `KYC_PROVIDER=mock` accepts the code `MOCK_OK` | Port only — **no real adapter exists** | Choose an authorised KYC vendor; an adapter must be written for it before Advisors can onboard for real |
| PAN verification | `PAN_PROVIDER=mock` verifies any well-formed PAN | Port only — **no real adapter exists** | Choose a PAN verification vendor; adapter to be written |
| WhatsApp | Hand-off only (opens WhatsApp with the text); no delivery status | Works as designed for hand-off | Decide if hand-off is enough for launch; a Business API integration is separate work. Set `compliance.whatsappConsentPolicy` |
| Push notifications | `PUSH_PROVIDER=expo` on staging | Works through Expo's push service | Confirm on a real phone |

## 2. Decisions KBS must enter (Admin → Configuration; each blocks the release check until set)
- `leads.declarations` — the real customer declaration texts (dev has `TEST:` placeholders).
- `payouts.designatedApproverManagerUserId` — who gives the Manager approval for Advisors reporting to Admin.
- `training.reactivationWindowHours`, and confirm `training.defaultPassThresholdPct`.
- `retention.callingRecordsDays`, `retention.recordingsDays`, `retention.misFilesDays`, `retention.documentsDays`.
- `compliance.callingListConsentConfirmedByCompliance`, `compliance.recordingDisclosureText`, `compliance.whatsappConsentPolicy`.
- `auth.recoveryEnabled`, `allocation.dedupeKey` (confirm).
- Office networks (Admin → Office network): the office egress IP ranges. Until one is active every Telecaller without a
  WFH exception is blocked (fails closed).
- Engineering dispositions awaiting confirmation: gap-analysis A22 and A23.

## 3. Production environment (staging is a free-tier stack and is not production)
Differences from `render.yaml` (staging) that production must have:
- `NODE_ENV=production` (no dev master OTP, no Swagger, secure cookies).
- A **worker process**: same build, `WORKER_MODE=1`, and the API with `JOBS_INLINE` unset and `JOBS_DISPATCH` unset/`queue`.
  It runs the outbox relay, MIS background jobs, the training-deadline sweep, retention and the follow-up-due notices.
  Without it none of those run.
- `SCAN_PROVIDER=clamav` with a reachable ClamAV (`CLAMAV_HOST`/`CLAMAV_PORT`); `docker/docker-compose.yml` has a `scan` profile for reference.
- Database: migrations as the owner, the API as the non-owner `kbs_app` role — runbook 03. Backups and a restore test.
- S3-compatible storage with real keys; `DATA_ENCRYPTION_KEY` stored in a password manager (losing it makes PAN and
  bank fields unreadable).
- Web: production domain, `WEB_ORIGIN` / `API_PUBLIC_URL` set to it.
- Mobile: put the production API URL in `apps/mobile/eas.json` → `build.production.env.EXPO_PUBLIC_API_URL`
  (still `https://api.example.invalid`), build the AAB (`eas build -p android --profile production`), keep the EAS keystore safe.

## 4. Evidence still to collect (release checklist, runbook 04)
- Maestro flows on the release build: `maestro test -e ADVISOR_MOBILE=… -e MANAGER_MOBILE=… apps/mobile/.maestro/`.
- SEC-02 on a physical Android 12+ phone: protected screens screenshot black, TalkBack still reads them (runbook 02).
- One full cycle on real phones on staging: Telecaller training → call → share; Advisor lead → MIS → payout → payment proof.
- k6 thresholds approved by KBS in `DOCS/perf/01-baseline-results.md` (only a sandbox baseline exists).
- DPDP / compliance sign-offs.

## 5. Go-live order
1. Providers in section 1 on **staging**; pilot with 2–3 real users on real phones.
2. Decisions in section 2 entered on staging; re-run the pilot paths they affect.
3. Create the production stack (section 3); `pnpm release:check -- --profile=production` until it exits 0.
4. Collect the evidence in section 4 against the production build.
5. First Admin from `BOOTSTRAP_ADMIN_MOBILE`; Admin creates Managers, Agent Codes, training modules, cards; upload the first calling list.
