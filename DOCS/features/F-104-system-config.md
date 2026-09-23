# F-104 SystemConfig with history and launch-gate checklist

- Group: Core · Status: **IN_PROGRESS** · Depends on: F-005, F-102, F-103
- PRD refs: REQ-05 §5.3 (Admin-configurable training rules), REQ-06 §6.4 (configurable allocation), REQ-08 §8.6 (configurable taxonomy requirements), REQ-17 (rule/rate versions), REQ-28 (OPEN items + §28.2 release gates), gap analysis D6

## Detailed requirements
1. `SystemConfig` key/value with typed values (`STRING | INT | BOOL | JSON | USER_ID | DURATION`), description, default, `requiresValueBeforeProd`. Every change writes `SystemConfigHistory` + audit with a mandatory reason.
2. Typed accessor `config.get('training.passRule')` with in-memory cache invalidated via Redis pub/sub.
3. Seeded keys (defaults in brackets; ★ = `requiresValueBeforeProd`):
   - `auth.otp.expirySec[300]`, `auth.otp.resendCooldownSec[60]`, `auth.otp.maxSendsPerMobilePerHour[10]`, `auth.otp.maxSendsPerIpPerHour[30]`, `auth.otp.maxAttempts[5]`, `auth.otp.lockMinutes[15]`, `auth.accessTokenMinutes[15]`, `auth.refreshTokenDays[30]`, `auth.telecallerSingleSession[true]`, `auth.webAccessRoles[["ADMIN","MANAGER","ACCOUNTS"]]`, `auth.recoveryEnabled[false]` ★
   - `training.windowHours[72]`, `training.passRule[PER_MODULE_THRESHOLD]`, `training.defaultPassThresholdPct[70]` ★, `training.attemptLimit[null=unlimited]`, `training.videoCompletionRequired[true]`, `training.shuffleQuestions[true]`, `training.reactivationWindowHours[null]` ★
   - `allocation.algorithm[ROUND_ROBIN_EQUAL]`, `allocation.maxActivePerTelecaller[null]`, `allocation.businessHoursOnly[false]`, `allocation.dedupeKey[["mobile"]]` ★
   - `network.enforceForTelecallers[true]`, `network.allowEmptyAllowlist[false]`
   - `calling.requireReasonForFollowUp[true]`, `calling.requireReasonForDecline[true]`, `calling.outcomeTaxonomyVersion[1]`
   - `mis.blankValueTokens[["","#N/A","N/A","NA","-"]]`
   - `payouts.designatedApproverManagerUserId[null]` ★, `payouts.approvalOrder[ANY]`, `payouts.proofRequiredForPaid[true]`, `payouts.requestStaleDays[30]`, `payouts.advisorCanCancelBeforeApproval[true]`
   - `hierarchy.agentCodeChangeRequiresAdminApproval[true]`, `hierarchy.agentCodeFormat[^[A-Z0-9]{4,12}$]`
   - `files.maxUploadMb[25]`, `files.requireCleanScanForNonAdmin[true]`, `files.presignExpirySec[300]`
   - `compliance.callingListConsentConfirmedByCompliance[false]` ★, `compliance.recordingDisclosureText[null]` ★, `compliance.whatsappConsentPolicy[null]` ★
   - `retention.*[null]` ★ (calling records, recordings, MIS files, documents)
   - `ux.timezone[Asia/Kolkata]`
4. `GET /config/launch-gates` → list of ★ keys with `isSet` — rendered on the Admin dashboard as the REQ-28 §28.2 checklist.
5. Admin UI (web): config table grouped by prefix, edit dialog with reason, history drawer.

## Acceptance criteria
- [ ] Changing a value without reason is rejected; history row created with old/new/actor.
- [ ] Cache invalidation propagates to a second API instance within 1 s (integration test with two app contexts sharing Redis).
- [ ] Launch-gate endpoint lists all ★ keys, none set on a fresh seed except those with defaults.

## Progress notes
- 2026-09-22 (session 1): API complete (typed access, history, reason required, launch gates, Redis invalidation) with e2e. Web page is read-only; edit dialog + history drawer pending.
- Session 8: resuming — Admin edit-with-reason + history drawer on web, two-instance cache invalidation test, full ★ launch-gate check.
