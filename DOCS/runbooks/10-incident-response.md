# Incident response: personal-data breach (F-908)

Use this runbook when personal data held by KBS Solutions may have been seen, copied, changed, lost or made unavailable by someone who should not have it. That includes a leaked secret, a lost staff phone with the app signed in, a wrong export, a provider breach notice, or an Admin account used by someone else.

Data held: see `DOCS/architecture/06-data-inventory.md`. Where each secret lives: runbook 06 (staging) and runbook 08 (production).

> **Owners are not named yet (REQ-21 §21.5 OPEN).** Every role below is **TO BE CONFIRMED** by KBS. Until then the person who notices the incident informs the KBS owner directly and starts the evidence log.

| Role | Person | Backup |
|---|---|---|
| Incident lead (decides, owns the timeline) | TO BE CONFIRMED | TO BE CONFIRMED |
| Technical lead (contain, rotate, restore) | TO BE CONFIRMED | TO BE CONFIRMED |
| Grievance Officer / privacy contact (people notices, Board) | TO BE CONFIRMED (`COMPANY.grievanceOfficer`) | — |
| CERT-In point of contact | TO BE CONFIRMED | — |

## Clocks that start when the incident is noticed

| Who | What | When |
|---|---|---|
| CERT-In | Report the cyber-security incident (CERT-In Directions, 28 Apr 2022) | **Within 6 hours** of noticing it |
| Data Protection Board of India | Initial intimation of the personal-data breach (DPDP Rules 2025) | **Without delay** |
| Data Protection Board of India | Detailed report: facts, cause, mitigation, people affected, notices sent | **Within 72 hours** of becoming aware (or longer if the Board allows) |
| Each affected Data Principal | Notice in plain language: what happened, likely consequences, what we did, what they can do, contact | **Without delay** |

Write the time of noticing in the evidence log first. Every later deadline is counted from it. Check the current text of the DPDP Rules and the CERT-In Directions before filing; this table is a summary, not legal advice.

## 1. Detect and triage (first 30 minutes)

1. Open the evidence log (template below). Note who noticed, when (IST), and how.
2. Decide if personal data is involved. If unsure, treat it as yes.
3. Find the scope with read-only queries:
   - Admin → Audit (`/admin/audit`): filter by actor, action and time. Exports are `audit.export`; reveals of PAN and bank details are in `SensitiveAccessLog` (admin audit page).
   - Sign-ins: `Session` (`ipAtLogin`, `userAgent`, `createdAt`) and `AuditLog` for the account in question.
   - Provider dashboards: Render logs, Supabase logs and storage access, Vercel logs, Exotel and Cashfree consoles.
4. Classify: what data categories, how many people, still ongoing or stopped.
5. Call the incident lead. Agree who files CERT-In and who drafts the notices.

## 2. Contain

Pick only the steps the scope needs. Each one has a cost. Log every step with the time.

| Step | How | Effect |
|---|---|---|
| Revoke one person's sessions | Admin → Users → the user → *Revoke sessions* (`POST /users/:id/sessions/revoke`) | That user is signed out on all devices. Access tokens already issued stay valid until they expire (15 min, `auth.accessTokenMinutes`). |
| Deactivate an account | Admin → Users → *Deactivate* | Blocks sign-in and revokes sessions. |
| Revoke **all** sessions | There is no admin button for this. Run in the database: `UPDATE "Session" SET "revokedAt" = now(), "revokedReason" = 'incident' WHERE "revokedAt" IS NULL;` | Everyone must sign in again once their access token expires. For an immediate cut-off, also rotate `JWT_ACCESS_SECRET`. |
| Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Change in Render (production: the secret store in runbook 08), redeploy | Every token becomes invalid at once. Everyone is signed out (web and app). |
| Rotate `OTP_PEPPER` | Same | Codes already sent stop working. Users request a new code. |
| Rotate the DB password | Supabase → Database → reset password, then update `DATABASE_URL` in Render and GitHub | API restarts. Do this if the URL or the password leaked. |
| Rotate S3 keys | Supabase → Storage → S3 → revoke the key, create a new one, update `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Uploads and downloads fail until the new key is set. |
| Rotate provider keys | MSG91, Cashfree verification, Exotel (`EXOTEL_*`, webhook token), Expo access token, Vercel and Render tokens, GitHub secrets | Calls to that provider fail until the new key is set. Change the Exotel webhook token in both places. |
| Pause background jobs | Unset `JOBS_INLINE` / stop the worker | Stops outbox relay, follow-up pushes, nightly purge and retention. |
| Take the web or API offline | Render → Suspend; Vercel → pause the project | Full outage. Last resort. |

### `DATA_ENCRYPTION_KEY` (PAN and bank account numbers)

`CryptoService` encrypts `CallingRecord.panEncrypted`, `Lead.customerPanEncrypted` and `AdvisorProfile.bankAccountEncrypted` (AES-256-GCM) with this one key. Ciphertexts carry a `v1.` prefix but no key id, so the API can hold only one key.

- **Do not just replace the key.** Every encrypted value becomes unreadable: PAN reveal, bank details for payouts and lead PAN checks all fail.
- If the key leaked **and** the database leaked, the encrypted fields must be treated as exposed. Rotating afterwards protects only future copies.
- If only the key leaked (no database copy), rotation is still right, but needs a re-encryption step that does not exist yet: a one-off script that reads each value with the old key and writes it with the new one, in a maintenance window, with a database backup taken first. Build and test it on a copy before touching production.
- `panLast4` and `bankAccountLast4` are plaintext by design and are not affected.

## 3. Assess

Within 24 hours, write down:

- Categories of data and of people affected (Advisors, staff, customers, prospects on calling lists).
- Number of people, with the query used to count them.
- Whether PAN or bank numbers were exposed in clear, or only encrypted.
- Likely consequences for the people affected (fraud calls, phishing, identity misuse).
- Root cause, and whether it is fixed.

## 4. Notify

1. **CERT-In**, within 6 hours: use the form and email on cert-in.org.in. Keep a copy and the acknowledgement.
2. **Data Protection Board**: initial intimation without delay, then the detailed report within 72 hours.
3. **Affected people**, without delay: through the app notification centre, SMS or email to the contact we hold. Plain language. Say what happened, what data, what we have done, what they should do (for example, never share an OTP; watch for calls claiming to be from a bank) and how to reach the Grievance Officer.
4. **Banks and processors**, when their data or systems are involved, as the contracts require.
5. Record every notice sent (who, when, channel, text) in the evidence log.

## 5. Recover and review

- Restore from backup only after the cause is closed. Note what was lost.
- Hold a review within two weeks. Update this runbook, the data inventory and the release check with what you learned.

## Evidence log template

Keep one per incident in a private, access-controlled place (not in this public repository).

```
Incident id:           INC-YYYYMMDD-NN
Noticed at (IST):      
Noticed by / how:      
Incident lead:         
Status:                open | contained | closed

Timeline (IST, newest last)
  hh:mm  who  what was seen / done / decided

Scope
  Data categories:     
  People affected:     count + query used
  Systems:             
  Still ongoing?       

Containment steps      (time, step, by whom, effect)
Secrets rotated        (name, time, by whom; never the value)

Notifications
  CERT-In:             sent at / reference
  DPB initial:         sent at
  DPB detailed:        sent at
  Data Principals:     channel, count, sent at, text attached
  Others:              

Root cause:            
Fix and follow-ups:    
Review held on:        
```
