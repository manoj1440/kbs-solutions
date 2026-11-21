# Personal-data inventory (F-908)

Every category of personal data the platform holds: where it lives, why, who can see it, how it is protected, how long it is kept and which processor touches it. The privacy notice (`packages/shared/src/legal/privacy-notice.ts`, `/privacy`) is the plain-language version of this table. Keep both in sync when the schema changes.

**Storage, currently (staging, F-907):** Postgres and objects on Supabase, Seoul (`ap-northeast-2`); API and Redis on Render, Singapore; web on Vercel, `sin1`. Production storage region: `COMPANY.dataStorageRegion` (not set yet; owner follow-up in F-908 §4). All traffic is HTTPS. Database volume and object-store encryption at rest are the provider's.

**Retention keys:** `retention.*Days` (F-904) are all unset, so nothing in the "F-904" rows is ever deleted automatically. Rows marked "F-908 purge" are deleted by the nightly `privacy.purgeOperational` job (`apps/api/src/modules/maintenance/data-purge.service.ts`). "Manual" means staff act on a `DataRequest` (ERASURE) by hand.

**Roles:** A = Admin, M = Manager, AC = Accounts, T = Telecaller, ADV = Advisor. "Scoped" means the server limits rows to the user's own team or own records.

## People and accounts

| Data | Model.field | Purpose | Who can see it | Protection | Retention | Processors |
|---|---|---|---|---|---|---|
| Mobile number | `User.mobile` | Sign-in (OTP), contact | A; M/AC scoped; the user | — | Manual | Supabase, Render; MSG91 (OTP SMS, when on) |
| Name, email, employee code | `User.fullName`, `.email`, `.employeeCode` | Identify the person, ID card | Signed-in staff by scope | — | Manual | Supabase, Render |
| Sign-in sessions | `Session` (`ipAtLogin`, `userAgent`, `deviceId`, `pushToken`), `RefreshToken` | Keep signed in, revoke, investigate | A (user detail); the user (own devices) | Refresh tokens hashed | F-908 purge: 30 days after revocation or expiry | Supabase, Render |
| OTP challenges | `OtpChallenge` (`mobile`, `ip`, hashed code) | Sign-in, rate limits, lockout | No UI | Code hashed with `OTP_PEPPER` | F-908 purge: 1 day after expiry | Supabase; MSG91 sends the code |
| Push tokens | `PushDevice.token`, `Session.pushToken` | Deliver notifications | No UI | Revoked on sign-out / deactivation | Session purge; device rows manual | Expo, Google FCM (outside India) |
| Notification text | `Notification.title`, `.body` | In-app and push notices | The recipient | No customer data in text (REQ-21 §21.1, F-908 D6: leads by `KBS-L-…` reference) | Manual | Expo, FCM |
| Audit trail | `AuditLog` (`actorUserId`, `ip`, `before`/`after`) | Accountability (REQ-24) | A | Append-only; `kbs_app` cannot delete (runbook 03) | Kept; out of F-904 scope | Supabase |
| Sensitive-access log | `SensitiveAccessLog` | Who revealed PAN / bank / files | A | Append-only | Kept | Supabase |
| Network access events | `NetworkAccessEvent.ip` | Telecaller office-network policy (F-301) | A, M scoped | — | Manual | Supabase |
| Data rights requests | `DataRequest` (`details`, `staffNote`, `resolutionNote`) | DPDP access / correction / erasure / grievance queue | A (`/admin/privacy-requests`); the requester (own) | `staffNote` never shown to the requester | Manual | Supabase |

## Advisors

| Data | Model.field | Purpose | Who can see it | Protection | Retention | Processors |
|---|---|---|---|---|---|---|
| Identity check result | `AdvisorProfile.identityStatus`, `.identityProvider`, `.identityProviderRef`, `.identityEvidenceSummary` | Verify the Advisor before activation; refuse under-18s | A (onboarding review) | Aadhaar number never stored (REQ-21 §21.4) | Manual | Cashfree (DigiLocker) |
| PAN (when collected) | Through the PAN provider; `onboarding.collectAdvisorPan` is off by default | Payout tax records | A | Masked | Manual | Cashfree PAN |
| Bank account | `AdvisorProfile.bankAccountEncrypted`, `.bankAccountLast4`, `.ifsc`, `.bankName`, `.accountHolderName` | Pay payouts | A, AC (reveal logged); the Advisor (last 4) | AES-256-GCM (`DATA_ENCRYPTION_KEY`); last 4 plaintext | Manual; payout records kept as law requires | Supabase |
| Cancelled cheque | `StoredFile` (`purpose = CHEQUE`), `AdvisorProfile.chequeFileId` | Bank account proof | A, AC | Private bucket, 5-minute presigned URLs, scan gate | F-904 `retention.documentsDays` (protected while referenced) | Supabase Storage |
| Consent records | `AdvisorProfile.consentRecords` | Proof of consent (notice version, time) | A | — | Kept while the account exists | Supabase |
| ID card | `OfficialIdCard.fields`, rendered `StoredFile` (`ID_CARD`) | Public verification at `/verify/[ref]` (name, code, validity only) | Public by reference | Revocable | F-904 documents | Supabase |
| Payouts and payments | `PayoutEntitlement*`, `PayoutRequest*`, `ExternalPayment`, proofs (`PAYMENT_PROOF`) | Pay Advisors, tax and audit | A, AC; the Advisor (own) | Append-only ledgers | Kept as law requires; never in F-904 scope | Supabase |

## Customers and prospects

| Data | Model.field | Purpose | Who can see it | Protection | Retention | Processors |
|---|---|---|---|---|---|---|
| Lead applicant | `Lead.customerFullName`, `.customerMobile`, `.pincode`, `.employmentType`, `.annualIncomeItr`, `.declarations` | Submit the card application the customer asked for | The Advisor (own), M scoped, A | — | Manual | Supabase; the chosen bank |
| Lead PAN | `Lead.customerPanEncrypted`, `.customerPanLast4` | Bank application, PAN check | A, M scoped (reveal logged) | AES-256-GCM | Manual | Cashfree PAN |
| Lead drafts | `LeadDraft.data` (may hold encrypted PAN) | Resume an unfinished lead form | The Advisor (own) | PAN encrypted | 7 days idle, then F-908 purge on expiry | Supabase |
| Follow-up tasks | `FollowUpTask.text` | Advisor reminders | The owner | Not sent in push text | Manual | Supabase |
| Calling-list rows | `CallingRecord.fullName`, `.mobile`, `.panEncrypted`, `.panLast4`, `.pincode` | Call prospects from approved lists | Assigned T, M scoped, A | PAN encrypted; mobile hidden from push | F-904 `retention.callingRecordsDays` (restricted, never deleted; INV-07) | Supabase; Exotel dials the number |
| Call outcomes and remarks | `CallOutcome.remarks`, `CallingInterest`, `OperationalRemark` | Track the conversation | T, M scoped, A | — | With the calling record | Supabase |
| Call recordings | `CallRecording`, `StoredFile` (`RECORDING`) | Quality and disputes (REQ-21 §21.3) | A, M scoped (access logged) | Private bucket, presigned URLs | F-904 `retention.recordingsDays` | Exotel, Supabase Storage |
| Contact suppressions | `ContactSuppression.mobile` | Never call people who opted out | A, M | — | Kept (needed to honour the opt-out) | Supabase |
| Uploaded lists | `StoredFile` (`CUSTOMER_LIST`, `DND_LIST`) | Import and audit of a batch | A | Private bucket | F-904 documents | Supabase Storage |
| Bank MIS rows | `MisRow.raw`, `.mapped`, `BankStatusSnapshot`, `BankStatusHistory` | Bank status of each application, payouts | A, M scoped; the Advisor (own leads) | Append-only history; `kbs_app` cannot delete | Kept (payout audit); MIS files under F-904 `retention.misFilesDays` | Supabase |
| Share links | `ShareAction`, `LeadLinkInitiation` | Send the bank's application link | T, ADV (own) | — | Manual | Supabase |

## Technical records without personal content

| Data | Model | Retention |
|---|---|---|
| Idempotency replays (may contain response bodies with names) | `IdempotencyRecord` | F-908 purge after 7 days |
| Outbox events | `OutboxEvent` | Kept (ids only) |

## Processors (currently)

| Processor | What it receives | Region (currently) | DPA |
|---|---|---|---|
| Supabase | Whole database, stored files | Seoul, South Korea | To be signed (F-908 §4) |
| Render | API memory, logs (redacted), Redis queue data | Singapore | To be signed |
| Vercel | Web requests, server-rendered pages | Singapore (`sin1`) | To be signed |
| Expo, Google FCM | Push token, notification title and body | Outside India (provider-run) | To be signed |
| Cashfree | Advisor identity (DigiLocker), PAN checks | Not documented in the repo | To be signed |
| Exotel | Phone numbers called, recordings | Not documented in the repo | To be signed |
| MSG91 (when enabled) | Mobile number, OTP | Not documented in the repo | To be signed |

See also: `DOCS/architecture/05-security-and-privacy.md`, `DOCS/runbooks/10-incident-response.md`, `DOCS/features/F-904-data-retention.md`.
