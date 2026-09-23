# Data model (logical → Prisma)

Implements REQ-22 (conceptual model) plus the additions from `DOCS/analysis/01-gap-analysis.md`. The Prisma schema in `packages/db/prisma/schema.prisma` is the executable version of this document; when they disagree, fix the schema **and** this doc in the same commit.

Conventions: PK `id` UUIDv7 (`String @id @default(uuid(7))`), `createdAt`/`updatedAt` timestamptz UTC, soft-hide via `hiddenAt`, never hard delete rows that carry audit weight. Public references (`KBS-L-…`) are separate unique columns.

## 1. Identity, roles, hierarchy

### User
| Column | Notes |
|---|---|
| id, publicRef | `KBS-U-…` |
| mobile (unique, E.164) | login identity, immutable except via Admin recovery flow |
| role enum `ADMIN, MANAGER, TELECALLER, ADVISOR, ACCOUNTS` | exactly one `ADMIN` row — partial unique index |
| fullName, email (nullable; mandatory for Advisor) | |
| status enum `PENDING_ONBOARDING, ACTIVE, DEACTIVATED, BLOCKED` | |
| createdByUserId (nullable for self-registered Advisor and seed Admin) | |
| employeeCode (unique nullable) | Telecaller `KBS-TC-…`, generated at creation |
| lastLoginAt | |

### UserLifecycleEvent — append-only
`userId, eventType(CREATED, ACTIVATED, DEACTIVATED, BLOCKED, REACTIVATED, ROLE_NOTE), actorUserId, reason, metadata jsonb, at`

### ReportingAssignment — effective-dated
`childUserId, parentUserId (Manager or Admin), source(MANAGER_CREATED_TELECALLER, AGENT_CODE, ADMIN_DEFAULT, ADMIN_REASSIGNED), agentCodeId?, effectiveFrom, effectiveTo?, approvedByUserId?, reason`. Current parent = row with `effectiveTo IS NULL`. Unique on `(childUserId) WHERE effectiveTo IS NULL`.

### AgentCode
`code (unique, uppercase), ownerUserId (Manager or Admin), status(ACTIVE, REVOKED), expiresAt?, createdByUserId`

### Session / RefreshToken
`Session(id, userId, deviceId?, platform(ANDROID, WEB), userAgent, ipAtLogin, createdAt, revokedAt, revokedReason)`; `RefreshToken(id, sessionId, tokenHash, familyId, expiresAt, usedAt, replacedById)`. Reuse of a used token revokes the whole family.

### OtpChallenge
`mobile, codeHash, purpose(LOGIN, ADVISOR_SIGNUP), expiresAt, attempts, consumedAt, ip, createdAt`. Plaintext code never stored (REQ-04 §4.1).

## 2. Configuration & audit

### SystemConfig / SystemConfigHistory
`key (unique), valueJson, valueType, description, requiresValueBeforeProd bool, updatedByUserId, updatedAt`. History keeps every prior value with actor and reason.

### AuditLog — append-only
`id, at, actorUserId?, actorRole?, action (dot.notation e.g. `training.reactivate`), entityType, entityId, requestId, ip, before jsonb?, after jsonb?, reason?, metadata jsonb`

### SensitiveAccessLog — append-only
`at, actorUserId, entityType, entityId, field (PAN, BANK_ACCOUNT, RECORDING, CHEQUE, PROOF, AADHAAR_RESULT), purpose?, requestId`

### IdempotencyRecord
`(userId, key, route) unique, responseStatus, responseBody jsonb, createdAt`

## 3. Access policy (Telecaller network)

`OfficeNetwork(id, label, cidr, active, createdByUserId)`; `WfhException(id, telecallerUserId, grantedByUserId, startsAt, endsAt?, revokedAt?, revokedByUserId?, reason)`; `NetworkAccessEvent(userId, at, ip, ssidHint?, outcome(ALLOWED_OFFICE, ALLOWED_WFH, DENIED), matchedNetworkId?, exceptionId?)`.

## 4. Training

`TrainingModule(id, sequence 1..3, title, videoFileId, materialText?, passThresholdPct, version, publishedAt, publishedByUserId)`
`TrainingQuestion(moduleId, sequence, text, options jsonb[{key,text}], correctKey, version)`
`TrainingEnrollment(telecallerUserId unique, firstLoginAt, deadlineAt, status(IN_PROGRESS, PASSED, EXPIRED_DEACTIVATED, REACTIVATED_IN_PROGRESS), currentModuleSequence)`
`TrainingModuleResult(enrollmentId, moduleId, status(LOCKED, IN_PROGRESS, PASSED, FAILED), passedAt, bestScorePct, videoCompletedAt?)`
`TrainingAttempt(moduleResultId, startedAt, submittedAt, answers jsonb, scorePct, passed, moduleVersion)`
`TrainingReactivation(enrollmentId, byManagerUserId, at, reason, originalDeadlineAt, newDeadlineAt?, resumedAtModuleSequence)`
`TrainingConfig` values live in `SystemConfig` keys `training.*`.

## 5. Calling list (Telecaller operations)

`CustomerImportBatch(publicRef KBS-B-…, fileId, uploaderUserId, uploadedAt, checksum unique, headerMapping jsonb, totals jsonb{imported,rejected,skipped,duplicates}, status)`
`CallingRecord(id, batchId, sourceRowNumber, fullName, mobile (E.164), panEncrypted?, panLast4?, pincode char(6), resolvedCity?, resolvedState?, locationResolved bool, assignedTelecallerUserId?, assignedAt?, interactionStatus enum(UNTOUCHED, FOLLOW_UP, INTERESTED, LINK_SHARED, DECLINED, COMPLETED, UNREACHABLE), nextFollowUpAt?, hiddenAt?, hiddenReason?, suppressed bool, reviewStatus(ACCEPTED, NEEDS_REVIEW, EXCLUDED), reviewReason?, legalHold bool, legalHoldReason?, restrictedAt?)` — F-904: a retention run restricts (redacts name/mobile/PAN, hides) instead of deleting (INV-07); `legalHold` blocks it.
`AllocationEvent(callingRecordId, fromTelecallerUserId?, toTelecallerUserId?, batchId?, at, actorUserId?, reason, algorithmVersion)`
`ContactSuppression(mobile unique, reason(CUSTOMER_REQUEST, COMPLIANCE, DND_LIST), sourceCallingRecordId?, createdByUserId, at, liftedAt?, liftedByUserId?)`
`PincodeMaster(pincode, officeName, district, state, importedAt)` (PK pincode+officeName).

## 6. Catalogue & bank pincode sourcing

`Bank(id, code unique e.g. HDFC, displayName, active)`
`CardCategory(id, key, label, sequence, active)`
`CreditCard(id, bankId, name, productCode?, imageFileId?, description, benefits jsonb, joiningFee, annualFee, majorCharges jsonb, eligibilityHighlights, disclosures, benefitPdfFileId?, status(DRAFT, PUBLISHED, RETIRED), version)`
`CreditCardCategory(cardId, categoryId)`
`ApplicationLink(id, cardId, channel(TELECALLER, ADVISOR, BOTH), url, version, effectiveFrom, effectiveTo?, createdByUserId)` — original URL preserved verbatim including query/fragment (REQ-07 §7.5).
`ProductCodeCrosswalk(bankId, misProductCode, cardId, confirmedByUserId, at)`
`BankPincodeProfile(id, bankId, version, sheetName?, headerMapping jsonb, pincodeColumn, semantics jsonb{sourceableRules}, approvedByUserId, approvedAt)`
`BankPincodeBatch(id, profileId, fileId, checksum, uploaderUserId, uploadedAt, rowCount, status)`
`BankPincodeRow(id, batchId, sourceRowNumber, pincode char(6), raw jsonb, sourceability(SOURCEABLE, NOT_SOURCEABLE, REQUIRES_BANK_MAPPING), channelFlags jsonb)` index `(bankId via batch, pincode)`.
`CardPincodePublication(cardId, pincode? or stateFilter?, channel, publishedByUserId, effectiveFrom, effectiveTo?)` — Admin's "published for that location/channel" (REQ-07 §7.4).

## 7. Telephony & sharing

`CallAttempt(id, callingRecordId, telecallerUserId, providerKey, providerCallId?, targetMobileMasked, initiatedAt, providerState enum(REQUESTED, RINGING, CONNECTED, ENDED, FAILED, NO_ANSWER, UNKNOWN), connectedAt?, endedAt?, durationSec?, failureReason?, idempotencyKey unique)`
`CallRecording(callAttemptId unique, providerRecordingId, status(AVAILABLE, FAILED, PENDING, NOT_ATTEMPTED), fileId?, durationSec?, retrievedAt?)`
`CallOutcome(callAttemptId?, callingRecordId, telecallerUserId, outcome enum(NO_ANSWER_OR_FAILED, CONNECTED_INTERESTED, CONNECTED_LINK_OR_PDF_SHARED, FOLLOW_UP, DECLINED, COMPLETED_NO_FURTHER), remarks?, followUpAt?, selectedCardId?, at)`
`CallingInterest(callingRecordId, telecallerUserId, cardId, applicationLinkId, at)` — the "operational lead" (REQ-08 §8.7), never a payout source.
`ShareAction(id, actorUserId, callingRecordId? | leadId?, kind(BENEFIT_PDF, OFFICE_ID, APPLICATION_LINK), cardId?, assetVersionRef, targetMobileMasked, channel(WHATSAPP_HANDOFF, WHATSAPP_BUSINESS_API), handoffResult(OPENED, FAILED), deliveryStatus(UNKNOWN, SENT, DELIVERED, FAILED), providerMessageId?, at)`
`OfficialIdCard(userId, version, renderedFileId, issuedAt, revokedAt?, fields jsonb)`
`OperationalRemark(entityType, entityId, authorUserId, text, at, editedAt?, editHistory jsonb)`

## 8. Advisor onboarding & leads

`AdvisorProfile(userId unique, onboardingStep, identityVerification(status, provider, providerRef, verifiedAt, method), panVerification?(status…), bankAccountEncrypted, bankAccountLast4, ifsc, accountHolderName, chequeFileId?, consentRecords jsonb[], submittedAt, reviewedByUserId?, reviewedAt?, reviewOutcome?)`
`Lead(id, publicRef KBS-L-…, advisorUserId, reportingParentUserIdSnapshot, cardId, bankId, customer: fullName, mobile, panEncrypted, panLast4, panVerificationStatus, pincode, city?, state?, employmentType enum(SALARIED, SELF_EMPLOYED, SELF_EMPLOYED_PROFESSIONAL), annualIncomeItr decimal, declarations jsonb, bureauAckAt, createdAt, idempotencyKey unique)`
`LeadLinkInitiation(leadId, applicationLinkId, linkVersion, action(SHARED, OPENED), at, byUserId)`
`BankApplicationLinkage(id, leadId, bankId, referenceKind(APPLICATION_NO, APPLICATION_REFERENCE_NUMBER, OTHER), referenceValue (exact string), source(ADVISOR_ENTERED, ADMIN_ENTERED, ISSUER_CALLBACK, MIS_RESOLVED_BY_ADMIN), verificationStatus(UNVERIFIED, VERIFIED_BY_MIS_MATCH, REJECTED), enteredByUserId, at)` unique `(bankId, referenceKind, referenceValue)`.
`FollowUpTask(leadId | callingRecordId, ownerUserId, text, dueAt, doneAt?, source KBS_OPERATIONAL)`

## 9. MIS (bank source of truth)

`MisImportProfile(id, bankId, version, name, sheetSelector, headerAliases jsonb, fieldMap jsonb{internalField: rawHeader}, referenceFields jsonb[ordered], snapshotMode(DELTA, FULL_SNAPSHOT), blankOverwrites bool, timezone, dateFormats jsonb, knownValues jsonb{field:[values]}, approvedByUserId?, approvedAt?)`
`MisImportBatch(id, publicRef KBS-B-…, bankId, profileId, fileId, checksum, uploaderUserId, uploadedAt, stage(UPLOADED, PARSED, MAPPED, PREVIEWED, APPLYING, APPLIED, FAILED, REJECTED), totals jsonb{rows, matched, unmatched, updatedChanged, updatedNoChange, conflicts, invalid, needsReview}, previewJson, appliedAt?, error?)`
`MisRow(id, batchId, sourceRowNumber, rowHash, raw jsonb (exact header → exact cell text), mapped jsonb, referenceValues jsonb, matchState(MATCHED, UNMATCHED, CONFLICT, INVALID, DUPLICATE_IN_BATCH), matchedLeadId?, matchExplanation, reviewedByUserId?, reviewedAt?, resolution?)` unique `(batchId, rowHash)`.
`BankStatusSnapshot(leadId unique, bankId, currentStage?, finalDecision?, cardActivationStatus?, kycStatus?, vkycStatus?, bkycStatus?, ipaStatus?, dropoffReason?, declineCode?, declineDescription?, declineDescription2?, declineType?, reason?, curableFlag?, productCode?, productDescription?, cardType?, bankCreationDateTime?, bankCreationDate?, finalDecisionDate?, vkycConsentDate?, vkycExpiryDate?, decisionMonth?, rawLatest jsonb, lastMatchedBatchId, lastMatchedAt, firstMatchedAt)` — **written only by mis/apply**. Absent row = "Awaiting MIS Update". Null field = "Not reported".
`BankStatusHistory(id, leadId, batchId, misRowId, field, oldValue?, newValue?, reportedEventDate?, importedAt, uploaderUserId, changeKind(SET, CHANGED, CONFIRMED_SAME, REPORTED_BLANK, ABSENT_FROM_BATCH))` unique `(leadId, batchId, field)`.

## 10. Payouts

`PayoutRule(id, bankId, name, version, triggerField (e.g. cardActivationStatus), triggerValues jsonb[], productCodePattern?, holdDays, effectiveFrom, effectiveTo?, approvedByUserId, notes)`
`PayoutRate(id, ruleId, amountInr decimal, effectiveFrom, effectiveTo?, approvedByUserId)`
`PayoutEntitlement(id, leadId, advisorUserId, reportingParentSnapshot, bankId, cardId, eventKey unique (bankId+reference+triggerValue+ruleVersion), ruleId, ruleVersion, rateId, amountInr, evidenceBatchId, evidenceMisRowId, eligibleAt, state(ELIGIBLE_AVAILABLE, RESERVED, PAID, UNDER_REVIEW, VOID), currentRequestId?)`
`PayoutEntitlementEvent(entitlementId, at, from, to, requestId?, actorUserId?, reason, batchId?)` append-only.
`PayoutRequest(id, publicRef KBS-PR-…, advisorUserId, managerApproverUserId, itemCount, totalAmountInr, submittedAt, state(PENDING_APPROVALS, APPROVED, REJECTED, CANCELLED, PAYMENT_RECORDED_PENDING_PROOF, PAID, ON_HOLD), snapshot jsonb, idempotencyKey unique)`
`PayoutRequestItem(requestId, entitlementId unique-while-active, amountSnapshotInr)`
`PayoutApproval(requestId, approverRole(MANAGER, ADMIN), approverUserId, decision(APPROVED, REJECTED), reason?, at)` unique `(requestId, approverRole)`.
`ExternalPayment(id, requestId, recordedByUserId, paidAt, amountInr, transferReference (as entered), transferReferenceKey (upper-cased, no whitespace), method?, proofFileId?, proofAttachedAt?, state(RECORDED, PROOF_PENDING, VERIFIED, EXCEPTION, CORRECTION_PENDING, SUPERSEDED, CORRECTION_REJECTED), exceptionReason?, exceptionRaisedAt?, exceptionRaisedByUserId?, resolvedAt?, resolvedByUserId?, resolutionNote?, correctionOfId? → ExternalPayment, correctionReason?, correctionDecidedAt?, correctionDecidedByUserId?, correctionDecisionReason?, supersededAt?)` — append-only; a request has at most one *live* entry (RECORDED/PROOF_PENDING/VERIFIED/EXCEPTION). F-605.
`PayoutRequest` also carries `holdReason?, heldAt?, heldByUserId?, paidAt?` (F-605).
`PayoutExceptionResolution(id, kind, subjectId, resolvedByUserId, reason, resolvedAt)` unique `(kind, subjectId)` — acknowledgement of a derived exception (`STALE_REQUEST`:requestId, `MIS_CORRECTION_AFTER_PAYMENT`:entitlementEventId). Exceptions themselves are computed on read (F-606).

## 11. Files, notifications

`StoredFile(id, bucket, key, contentType, sizeBytes, sha256, uploadedByUserId, purpose enum, scanStatus(PENDING, CLEAN, INFECTED, SKIPPED), createdAt, legalHold bool, legalHoldReason?, purgedAt?)` — F-904: `purgedAt` = object deleted by an authorised retention run; the row stays as the trace and downloads return 410 `FILE_PURGED`.
`Notification(id, recipientUserId, kind, title, body, deepLink jsonb{entityType, entityId}, sourceRef jsonb{batchId?, field?}, dedupeKey unique, createdAt, readAt?, pushedAt?)`
`OutboxEvent(id, type, payload jsonb, createdAt, processedAt?, attempts)`.
`PushDevice(id, userId, sessionId?, token unique (Expo push token), platform, createdAt, lastSeenAt, revokedAt?)` — F-701 push targets; revoked on logout.

## 12. Cross-cutting invariants enforced in DB

- Partial unique: one `ADMIN` user; one open `ReportingAssignment` per child; one `RESERVED/PAID` request item per entitlement; one live `ExternalPayment` per request; one live `ExternalPayment` per `transferReferenceKey` (duplicate bank reference refused); one `CORRECTION_PENDING` per request.
- `BankStatusSnapshot` and `BankStatusHistory` have no update path outside MIS apply (application-level guard now; DB trigger in hardening feature F-903).
- `ContactSuppression.mobile` checked by unique index + service before any `CallAttempt` insert.
- Batch `checksum` unique per bank/profile → identical re-upload returns the earlier batch (REQ-13 §13.6 row 9).
