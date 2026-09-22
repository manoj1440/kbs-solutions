-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'TELECALLER', 'ADVISOR', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_ONBOARDING', 'ACTIVE', 'DEACTIVATED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'ADVISOR_SIGNUP');

-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('BANK_MIS', 'KBS_OPERATIONAL', 'KBS_PAYMENT');

-- CreateEnum
CREATE TYPE "UserLifecycleEventType" AS ENUM ('CREATED', 'ACTIVATED', 'DEACTIVATED', 'BLOCKED', 'REACTIVATED', 'MOBILE_CHANGED');

-- CreateEnum
CREATE TYPE "ReportingSource" AS ENUM ('MANAGER_CREATED_TELECALLER', 'AGENT_CODE', 'ADMIN_DEFAULT', 'ADMIN_REASSIGNED');

-- CreateEnum
CREATE TYPE "ReportingAssignmentStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgentCodeStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('STRING', 'INT', 'BOOL', 'JSON', 'USER_ID', 'DURATION');

-- CreateEnum
CREATE TYPE "SensitiveField" AS ENUM ('PAN', 'MOBILE', 'BANK_ACCOUNT', 'RECORDING', 'CHEQUE', 'PROOF', 'AADHAAR_RESULT', 'MIS_RAW_ROW', 'ID_CARD');

-- CreateEnum
CREATE TYPE "NetworkAccessOutcome" AS ENUM ('ALLOWED_OFFICE', 'ALLOWED_WFH', 'DENIED');

-- CreateEnum
CREATE TYPE "TrainingEnrollmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'EXPIRED_DEACTIVATED', 'REACTIVATED_IN_PROGRESS');

-- CreateEnum
CREATE TYPE "ModuleResultStatus" AS ENUM ('LOCKED', 'IN_PROGRESS', 'PASSED');

-- CreateEnum
CREATE TYPE "TrainingModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'IMPORTED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('UNTOUCHED', 'FOLLOW_UP', 'INTERESTED', 'LINK_SHARED', 'DECLINED', 'COMPLETED', 'UNREACHABLE');

-- CreateEnum
CREATE TYPE "RecordReviewStatus" AS ENUM ('ACCEPTED', 'NEEDS_REVIEW', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('CUSTOMER_REQUEST', 'COMPLIANCE', 'DND_LIST');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('TELECALLER', 'ADVISOR', 'BOTH');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "Sourceability" AS ENUM ('SOURCEABLE', 'NOT_SOURCEABLE', 'REQUIRES_BANK_MAPPING');

-- CreateEnum
CREATE TYPE "CallProviderState" AS ENUM ('REQUESTED', 'RINGING', 'CONNECTED', 'ENDED', 'FAILED', 'NO_ANSWER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('NOT_ATTEMPTED', 'PENDING', 'AVAILABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "CallOutcomeKind" AS ENUM ('NO_ANSWER_OR_FAILED', 'CONNECTED_INTERESTED', 'CONNECTED_LINK_OR_PDF_SHARED', 'FOLLOW_UP', 'DECLINED', 'COMPLETED_NO_FURTHER');

-- CreateEnum
CREATE TYPE "ShareKind" AS ENUM ('BENEFIT_PDF', 'OFFICE_ID', 'APPLICATION_LINK');

-- CreateEnum
CREATE TYPE "ShareChannel" AS ENUM ('WHATSAPP_HANDOFF', 'WHATSAPP_BUSINESS_API');

-- CreateEnum
CREATE TYPE "HandoffResult" AS ENUM ('OPENED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('UNKNOWN', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('PERSONAL', 'CONSENT', 'IDENTITY', 'BANK', 'CHEQUE', 'AGENT_CODE', 'REVIEW', 'AWAITING_REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'MISMATCH', 'FAILED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('SALARIED', 'SELF_EMPLOYED', 'SELF_EMPLOYED_PROFESSIONAL');

-- CreateEnum
CREATE TYPE "LinkAction" AS ENUM ('SHARED', 'OPENED');

-- CreateEnum
CREATE TYPE "BankReferenceKind" AS ENUM ('APPLICATION_NO', 'APPLICATION_REFERENCE_NUMBER', 'OTHER');

-- CreateEnum
CREATE TYPE "LinkageSource" AS ENUM ('ADVISOR_ENTERED', 'ADMIN_ENTERED', 'ISSUER_CALLBACK', 'MIS_RESOLVED_BY_ADMIN');

-- CreateEnum
CREATE TYPE "LinkageVerification" AS ENUM ('UNVERIFIED', 'VERIFIED_BY_MIS_MATCH', 'REJECTED');

-- CreateEnum
CREATE TYPE "MisSnapshotMode" AS ENUM ('DELTA', 'FULL_SNAPSHOT');

-- CreateEnum
CREATE TYPE "MisBatchStage" AS ENUM ('UPLOADED', 'PARSED', 'MAPPED', 'PREVIEWED', 'APPLYING', 'APPLIED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MisRowMatchState" AS ENUM ('PENDING', 'MATCHED', 'UNMATCHED', 'CONFLICT', 'INVALID', 'DUPLICATE_IN_BATCH', 'IGNORED');

-- CreateEnum
CREATE TYPE "BankStatusChangeKind" AS ENUM ('SET', 'CHANGED', 'CONFIRMED_SAME', 'REPORTED_BLANK', 'ABSENT_FROM_BATCH');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "PayoutEntitlementState" AS ENUM ('PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED', 'PAID', 'UNDER_REVIEW', 'VOID');

-- CreateEnum
CREATE TYPE "PayoutRequestState" AS ENUM ('PENDING_APPROVALS', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ApprovalRole" AS ENUM ('MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExternalPaymentState" AS ENUM ('RECORDED', 'PROOF_PENDING', 'VERIFIED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('CUSTOMER_LIST', 'BANK_PINCODE', 'PINCODE_MASTER', 'MIS', 'TRAINING_VIDEO', 'CARD_IMAGE', 'BENEFIT_PDF', 'CHEQUE', 'PAYMENT_PROOF', 'ID_CARD', 'RECORDING', 'DND_LIST');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ASSIGNMENT_NEW', 'TRAINING_DEADLINE', 'TRAINING_DEACTIVATED', 'TRAINING_REACTIVATED', 'TRAINING_PASSED', 'WFH_GRANTED', 'WFH_REVOKED', 'FOLLOW_UP_DUE', 'RECORDING_STATUS', 'ONBOARDING_ISSUE', 'ONBOARDING_APPROVED', 'LEAD_CREATED', 'MIS_MATCHED', 'MIS_CHANGED', 'MIS_IMPORT_RESULT', 'PAYOUT_SUBMITTED', 'PAYOUT_APPROVAL_REQUIRED', 'PAYOUT_DECISION', 'PAYOUT_READY_FOR_PAYMENT', 'PAYOUT_PAID', 'PAYOUT_EXCEPTION', 'SECURITY_EVENT', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "employeeCode" TEXT,
    "createdByUserId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLifecycleEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "UserLifecycleEventType" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingAssignment" (
    "id" TEXT NOT NULL,
    "childUserId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "source" "ReportingSource" NOT NULL,
    "status" "ReportingAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "agentCodeId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "AgentCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AgentCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAtLogin" TEXT,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "phantom" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "value" JSONB,
    "defaultValue" JSONB,
    "description" TEXT NOT NULL,
    "requiresValueBeforeProd" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SystemConfigHistory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfigHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "requestId" TEXT,
    "ip" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitiveAccessLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" "SensitiveField" NOT NULL,
    "purpose" TEXT,
    "requestId" TEXT,

    CONSTRAINT "SensitiveAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeNetwork" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfhException" (
    "id" TEXT NOT NULL,
    "telecallerUserId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WfhException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkAccessEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,
    "ssidHint" TEXT,
    "outcome" "NetworkAccessOutcome" NOT NULL,
    "matchedNetworkId" TEXT,
    "exceptionId" TEXT,
    "route" TEXT,

    CONSTRAINT "NetworkAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModule" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "videoFileId" TEXT,
    "materialText" TEXT,
    "passThresholdPct" INTEGER NOT NULL,
    "status" "TrainingModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingQuestion" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "telecallerUserId" TEXT NOT NULL,
    "firstLoginAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "status" "TrainingEnrollmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentModuleSequence" INTEGER NOT NULL DEFAULT 1,
    "passedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModuleResult" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" "ModuleResultStatus" NOT NULL DEFAULT 'LOCKED',
    "passedAt" TIMESTAMP(3),
    "bestScorePct" INTEGER,
    "videoCompletedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingModuleResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAttempt" (
    "id" TEXT NOT NULL,
    "moduleResultId" TEXT NOT NULL,
    "moduleVersion" INTEGER NOT NULL,
    "questionIds" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "answers" JSONB,
    "scorePct" INTEGER,
    "passed" BOOLEAN,

    CONSTRAINT "TrainingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingReactivation" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "byManagerUserId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "originalDeadlineAt" TIMESTAMP(3),
    "newDeadlineAt" TIMESTAMP(3),
    "resumedAtModuleSequence" INTEGER NOT NULL,

    CONSTRAINT "TrainingReactivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerImportBatch" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" TEXT NOT NULL,
    "sheetName" TEXT,
    "headerMapping" JSONB,
    "totals" JSONB,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,
    "consentRepresentationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sourceVendor" TEXT,
    "permittedUseBasis" TEXT,
    "allocatedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallingRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "panEncrypted" TEXT,
    "panLast4" TEXT,
    "pincode" TEXT NOT NULL,
    "resolvedCity" TEXT,
    "resolvedState" TEXT,
    "locationResolved" BOOLEAN NOT NULL DEFAULT false,
    "assignedTelecallerUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "interactionStatus" "InteractionStatus" NOT NULL DEFAULT 'UNTOUCHED',
    "nextFollowUpAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "RecordReviewStatus" NOT NULL DEFAULT 'ACCEPTED',
    "reviewReason" TEXT,
    "possibleCollision" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationEvent" (
    "id" TEXT NOT NULL,
    "callingRecordId" TEXT NOT NULL,
    "fromTelecallerUserId" TEXT,
    "toTelecallerUserId" TEXT,
    "batchId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "reason" TEXT NOT NULL,
    "algorithmVersion" TEXT,

    CONSTRAINT "AllocationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSuppression" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "sourceCallingRecordId" TEXT,
    "createdByUserId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedByUserId" TEXT,
    "liftReason" TEXT,

    CONSTRAINT "ContactSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PincodeMaster" (
    "pincode" TEXT NOT NULL,
    "officeName" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PincodeMaster_pkey" PRIMARY KEY ("pincode","officeName")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CardCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productCode" TEXT,
    "imageFileId" TEXT,
    "description" TEXT,
    "benefits" JSONB,
    "joiningFee" DECIMAL(12,2),
    "annualFee" DECIMAL(12,2),
    "majorCharges" JSONB,
    "eligibilityHighlights" TEXT,
    "disclosures" TEXT,
    "benefitPdfFileId" TEXT,
    "status" "CardStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "forbiddenPhraseOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardCategory" (
    "cardId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CreditCardCategory_pkey" PRIMARY KEY ("cardId","categoryId")
);

-- CreateTable
CREATE TABLE "ApplicationLink" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "url" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCodeCrosswalk" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "misProductCode" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "confirmedByUserId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCodeCrosswalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPincodeProfile" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sheetName" TEXT,
    "headerMapping" JSONB NOT NULL,
    "pincodeColumn" TEXT NOT NULL,
    "semantics" JSONB NOT NULL,
    "padNumericPincodes" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankPincodeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPincodeBatch" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,

    CONSTRAINT "BankPincodeBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPincodeRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "pincode" TEXT NOT NULL,
    "wasPadded" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL,
    "sourceability" "Sourceability" NOT NULL,
    "channelFlags" JSONB,

    CONSTRAINT "BankPincodeRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPincodePublication" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "pincode" TEXT,
    "state" TEXT,
    "channel" "Channel" NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "CardPincodePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallAttempt" (
    "id" TEXT NOT NULL,
    "callingRecordId" TEXT NOT NULL,
    "telecallerUserId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerCallId" TEXT,
    "targetMobileMasked" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerState" "CallProviderState" NOT NULL DEFAULT 'REQUESTED',
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "CallAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecording" (
    "id" TEXT NOT NULL,
    "callAttemptId" TEXT NOT NULL,
    "providerRecordingId" TEXT,
    "status" "RecordingStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "fileId" TEXT,
    "durationSec" INTEGER,
    "retrievedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallOutcome" (
    "id" TEXT NOT NULL,
    "callAttemptId" TEXT,
    "callingRecordId" TEXT NOT NULL,
    "telecallerUserId" TEXT NOT NULL,
    "outcome" "CallOutcomeKind" NOT NULL,
    "remarks" TEXT,
    "followUpAt" TIMESTAMP(3),
    "selectedCardId" TEXT,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallingInterest" (
    "id" TEXT NOT NULL,
    "callingRecordId" TEXT NOT NULL,
    "telecallerUserId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "applicationLinkId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallingInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareAction" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "callingRecordId" TEXT,
    "leadId" TEXT,
    "kind" "ShareKind" NOT NULL,
    "cardId" TEXT,
    "assetVersionRef" TEXT,
    "targetMobileMasked" TEXT NOT NULL,
    "channel" "ShareChannel" NOT NULL,
    "handoffResult" "HandoffResult" NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'UNKNOWN',
    "providerMessageId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialIdCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "renderedFileId" TEXT,
    "fields" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OfficialIdCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalRemark" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "editHistory" JSONB,

    CONSTRAINT "OperationalRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'PERSONAL',
    "identityStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "identityProvider" TEXT,
    "identityProviderRef" TEXT,
    "identityVerifiedAt" TIMESTAMP(3),
    "identityMethod" TEXT,
    "identityEvidenceSummary" JSONB,
    "bankAccountEncrypted" TEXT,
    "bankAccountLast4" TEXT,
    "ifsc" TEXT,
    "bankName" TEXT,
    "accountHolderName" TEXT,
    "chequeFileId" TEXT,
    "consentRecords" JSONB,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewOutcome" "ReviewOutcome",
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadDraft" (
    "id" TEXT NOT NULL,
    "advisorUserId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "advisorUserId" TEXT NOT NULL,
    "reportingParentUserIdSnapshot" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "customerFullName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "customerPanEncrypted" TEXT,
    "customerPanLast4" TEXT,
    "panVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "panVerificationRef" TEXT,
    "pincode" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "locationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "employmentType" "EmploymentType" NOT NULL,
    "annualIncomeItr" DECIMAL(14,2) NOT NULL,
    "declarations" JSONB NOT NULL,
    "bureauAckAt" TIMESTAMP(3) NOT NULL,
    "possibleCollision" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadLinkInitiation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "applicationLinkId" TEXT NOT NULL,
    "linkVersion" INTEGER NOT NULL,
    "action" "LinkAction" NOT NULL,
    "byUserId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadLinkInitiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankApplicationLinkage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "referenceKind" "BankReferenceKind" NOT NULL,
    "referenceValue" TEXT NOT NULL,
    "source" "LinkageSource" NOT NULL,
    "verificationStatus" "LinkageVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "enteredByUserId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "BankApplicationLinkage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "callingRecordId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MisImportProfile" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sheetSelector" TEXT,
    "headerAliases" JSONB NOT NULL,
    "fieldMap" JSONB NOT NULL,
    "referenceFields" JSONB NOT NULL,
    "snapshotMode" "MisSnapshotMode" NOT NULL DEFAULT 'DELTA',
    "blankOverwrites" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "timezoneAssumed" BOOLEAN NOT NULL DEFAULT true,
    "dateFormats" JSONB,
    "knownValues" JSONB,
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MisImportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MisImportBatch" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sheetName" TEXT,
    "uploaderUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" "MisBatchStage" NOT NULL DEFAULT 'UPLOADED',
    "totals" JSONB,
    "preview" JSONB,
    "appliedAt" TIMESTAMP(3),
    "error" TEXT,
    "rejectReason" TEXT,

    CONSTRAINT "MisImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MisRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "mapped" JSONB,
    "mappedDates" JSONB,
    "referenceValues" JSONB,
    "matchState" "MisRowMatchState" NOT NULL DEFAULT 'PENDING',
    "matchedLeadId" TEXT,
    "matchExplanation" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "MisRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatusSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "applicationNo" TEXT,
    "applicationReferenceNumber" TEXT,
    "currentStage" TEXT,
    "finalDecision" TEXT,
    "cardActivationStatus" TEXT,
    "ipaStatus" TEXT,
    "kycStatus" TEXT,
    "vkycStatus" TEXT,
    "bkycStatus" TEXT,
    "kycSuccessNr" TEXT,
    "dropoffReason" TEXT,
    "declineCode" TEXT,
    "declineDescription" TEXT,
    "declineDescription2" TEXT,
    "declineType" TEXT,
    "reason" TEXT,
    "curableFlag" TEXT,
    "dapFinalFlag" TEXT,
    "idcomStatus" TEXT,
    "productCode" TEXT,
    "productDescription" TEXT,
    "cardType" TEXT,
    "securedUnsecured" TEXT,
    "customerType" TEXT,
    "channel" TEXT,
    "promoCode" TEXT,
    "lc2Code" TEXT,
    "bankCreationDateTime" TIMESTAMP(3),
    "bankCreationDate" TIMESTAMP(3),
    "finalDecisionDate" TIMESTAMP(3),
    "vkycConsentDate" TIMESTAMP(3),
    "vkycExpiryDate" TIMESTAMP(3),
    "decisionMonth" TEXT,
    "rawLatest" JSONB NOT NULL,
    "lastMatchedBatchId" TEXT NOT NULL,
    "lastMatchedAt" TIMESTAMP(3) NOT NULL,
    "firstMatchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankStatusSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatusHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "misRowId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reportedEventDate" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "changeKind" "BankStatusChangeKind" NOT NULL,

    CONSTRAINT "BankStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRule" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "triggerField" TEXT NOT NULL,
    "triggerValues" JSONB NOT NULL,
    "productCodePattern" TEXT,
    "holdDays" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRate" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "amountInr" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutEntitlement" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "advisorUserId" TEXT NOT NULL,
    "reportingParentSnapshot" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "rateId" TEXT NOT NULL,
    "amountInr" DECIMAL(12,2) NOT NULL,
    "evidenceBatchId" TEXT NOT NULL,
    "evidenceMisRowId" TEXT,
    "triggerFieldValue" TEXT NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "state" "PayoutEntitlementState" NOT NULL DEFAULT 'PENDING_HOLD',
    "currentRequestId" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutEntitlementEvent" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromState" "PayoutEntitlementState",
    "toState" "PayoutEntitlementState" NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "reason" TEXT,
    "batchId" TEXT,

    CONSTRAINT "PayoutEntitlementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "advisorUserId" TEXT NOT NULL,
    "managerApproverUserId" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "totalAmountInr" DECIMAL(14,2) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "PayoutRequestState" NOT NULL DEFAULT 'PENDING_APPROVALS',
    "snapshot" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "amountSnapshotInr" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverRole" "ApprovalRole" NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amountInr" DECIMAL(14,2) NOT NULL,
    "transferReference" TEXT NOT NULL,
    "method" TEXT,
    "proofFileId" TEXT,
    "state" "ExternalPaymentState" NOT NULL DEFAULT 'RECORDED',
    "exceptionReason" TEXT,
    "correctionOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" JSONB,
    "sourceRef" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "pushedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_publicRef_key" ON "User"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "UserLifecycleEvent_userId_at_idx" ON "UserLifecycleEvent"("userId", "at");

-- CreateIndex
CREATE INDEX "ReportingAssignment_childUserId_effectiveTo_idx" ON "ReportingAssignment"("childUserId", "effectiveTo");

-- CreateIndex
CREATE INDEX "ReportingAssignment_parentUserId_effectiveTo_idx" ON "ReportingAssignment"("parentUserId", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCode_code_key" ON "AgentCode"("code");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "OtpChallenge_mobile_createdAt_idx" ON "OtpChallenge"("mobile", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_ip_createdAt_idx" ON "OtpChallenge"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "SystemConfigHistory_key_at_idx" ON "SystemConfigHistory"("key", "at");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_at_idx" ON "AuditLog"("entityType", "entityId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_at_idx" ON "AuditLog"("actorUserId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_action_at_idx" ON "AuditLog"("action", "at");

-- CreateIndex
CREATE INDEX "SensitiveAccessLog_entityType_entityId_at_idx" ON "SensitiveAccessLog"("entityType", "entityId", "at");

-- CreateIndex
CREATE INDEX "SensitiveAccessLog_actorUserId_at_idx" ON "SensitiveAccessLog"("actorUserId", "at");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_createdAt_idx" ON "IdempotencyRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_userId_key_route_key" ON "IdempotencyRecord"("userId", "key", "route");

-- CreateIndex
CREATE INDEX "WfhException_telecallerUserId_startsAt_endsAt_revokedAt_idx" ON "WfhException"("telecallerUserId", "startsAt", "endsAt", "revokedAt");

-- CreateIndex
CREATE INDEX "NetworkAccessEvent_userId_at_idx" ON "NetworkAccessEvent"("userId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingModule_sequence_key" ON "TrainingModule"("sequence");

-- CreateIndex
CREATE INDEX "TrainingQuestion_moduleId_sequence_idx" ON "TrainingQuestion"("moduleId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrollment_telecallerUserId_key" ON "TrainingEnrollment"("telecallerUserId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_status_deadlineAt_idx" ON "TrainingEnrollment"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingModuleResult_enrollmentId_moduleId_key" ON "TrainingModuleResult"("enrollmentId", "moduleId");

-- CreateIndex
CREATE INDEX "TrainingAttempt_moduleResultId_startedAt_idx" ON "TrainingAttempt"("moduleResultId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerImportBatch_publicRef_key" ON "CustomerImportBatch"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerImportBatch_checksum_key" ON "CustomerImportBatch"("checksum");

-- CreateIndex
CREATE INDEX "CallingRecord_assignedTelecallerUserId_hiddenAt_nextFollowU_idx" ON "CallingRecord"("assignedTelecallerUserId", "hiddenAt", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "CallingRecord_mobile_idx" ON "CallingRecord"("mobile");

-- CreateIndex
CREATE INDEX "CallingRecord_batchId_sourceRowNumber_idx" ON "CallingRecord"("batchId", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "AllocationEvent_callingRecordId_at_idx" ON "AllocationEvent"("callingRecordId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSuppression_mobile_key" ON "ContactSuppression"("mobile");

-- CreateIndex
CREATE INDEX "PincodeMaster_pincode_idx" ON "PincodeMaster"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_code_key" ON "Bank"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CardCategory_key_key" ON "CardCategory"("key");

-- CreateIndex
CREATE INDEX "CreditCard_bankId_status_idx" ON "CreditCard"("bankId", "status");

-- CreateIndex
CREATE INDEX "ApplicationLink_cardId_channel_effectiveFrom_effectiveTo_idx" ON "ApplicationLink"("cardId", "channel", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCodeCrosswalk_bankId_misProductCode_key" ON "ProductCodeCrosswalk"("bankId", "misProductCode");

-- CreateIndex
CREATE UNIQUE INDEX "BankPincodeProfile_bankId_version_key" ON "BankPincodeProfile"("bankId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BankPincodeBatch_profileId_checksum_key" ON "BankPincodeBatch"("profileId", "checksum");

-- CreateIndex
CREATE INDEX "BankPincodeRow_bankId_pincode_idx" ON "BankPincodeRow"("bankId", "pincode");

-- CreateIndex
CREATE INDEX "BankPincodeRow_batchId_idx" ON "BankPincodeRow"("batchId");

-- CreateIndex
CREATE INDEX "CardPincodePublication_pincode_idx" ON "CardPincodePublication"("pincode");

-- CreateIndex
CREATE INDEX "CardPincodePublication_state_idx" ON "CardPincodePublication"("state");

-- CreateIndex
CREATE INDEX "CardPincodePublication_cardId_channel_idx" ON "CardPincodePublication"("cardId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CallAttempt_idempotencyKey_key" ON "CallAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CallAttempt_callingRecordId_initiatedAt_idx" ON "CallAttempt"("callingRecordId", "initiatedAt");

-- CreateIndex
CREATE INDEX "CallAttempt_telecallerUserId_initiatedAt_idx" ON "CallAttempt"("telecallerUserId", "initiatedAt");

-- CreateIndex
CREATE INDEX "CallAttempt_providerKey_providerCallId_idx" ON "CallAttempt"("providerKey", "providerCallId");

-- CreateIndex
CREATE UNIQUE INDEX "CallRecording_callAttemptId_key" ON "CallRecording"("callAttemptId");

-- CreateIndex
CREATE INDEX "CallOutcome_callingRecordId_at_idx" ON "CallOutcome"("callingRecordId", "at");

-- CreateIndex
CREATE INDEX "CallingInterest_callingRecordId_at_idx" ON "CallingInterest"("callingRecordId", "at");

-- CreateIndex
CREATE INDEX "ShareAction_callingRecordId_at_idx" ON "ShareAction"("callingRecordId", "at");

-- CreateIndex
CREATE INDEX "ShareAction_leadId_at_idx" ON "ShareAction"("leadId", "at");

-- CreateIndex
CREATE INDEX "OfficialIdCard_userId_revokedAt_idx" ON "OfficialIdCard"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "OperationalRemark_entityType_entityId_at_idx" ON "OperationalRemark"("entityType", "entityId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");

-- CreateIndex
CREATE INDEX "LeadDraft_advisorUserId_expiresAt_idx" ON "LeadDraft"("advisorUserId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_publicRef_key" ON "Lead"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_idempotencyKey_key" ON "Lead"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Lead_advisorUserId_createdAt_idx" ON "Lead"("advisorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_reportingParentUserIdSnapshot_idx" ON "Lead"("reportingParentUserIdSnapshot");

-- CreateIndex
CREATE INDEX "Lead_customerMobile_idx" ON "Lead"("customerMobile");

-- CreateIndex
CREATE INDEX "LeadLinkInitiation_leadId_at_idx" ON "LeadLinkInitiation"("leadId", "at");

-- CreateIndex
CREATE INDEX "BankApplicationLinkage_leadId_idx" ON "BankApplicationLinkage"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "BankApplicationLinkage_bankId_referenceKind_referenceValue_key" ON "BankApplicationLinkage"("bankId", "referenceKind", "referenceValue");

-- CreateIndex
CREATE INDEX "FollowUpTask_ownerUserId_dueAt_doneAt_idx" ON "FollowUpTask"("ownerUserId", "dueAt", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "MisImportProfile_bankId_version_key" ON "MisImportProfile"("bankId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MisImportBatch_publicRef_key" ON "MisImportBatch"("publicRef");

-- CreateIndex
CREATE INDEX "MisImportBatch_stage_uploadedAt_idx" ON "MisImportBatch"("stage", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MisImportBatch_bankId_checksum_key" ON "MisImportBatch"("bankId", "checksum");

-- CreateIndex
CREATE INDEX "MisRow_batchId_matchState_idx" ON "MisRow"("batchId", "matchState");

-- CreateIndex
CREATE INDEX "MisRow_matchedLeadId_idx" ON "MisRow"("matchedLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "MisRow_batchId_rowHash_key" ON "MisRow"("batchId", "rowHash");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatusSnapshot_leadId_key" ON "BankStatusSnapshot"("leadId");

-- CreateIndex
CREATE INDEX "BankStatusSnapshot_bankId_finalDecision_idx" ON "BankStatusSnapshot"("bankId", "finalDecision");

-- CreateIndex
CREATE INDEX "BankStatusSnapshot_bankId_cardActivationStatus_idx" ON "BankStatusSnapshot"("bankId", "cardActivationStatus");

-- CreateIndex
CREATE INDEX "BankStatusSnapshot_lastMatchedAt_idx" ON "BankStatusSnapshot"("lastMatchedAt");

-- CreateIndex
CREATE INDEX "BankStatusHistory_leadId_importedAt_idx" ON "BankStatusHistory"("leadId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatusHistory_leadId_batchId_field_key" ON "BankStatusHistory"("leadId", "batchId", "field");

-- CreateIndex
CREATE INDEX "PayoutRule_bankId_status_effectiveFrom_effectiveTo_idx" ON "PayoutRule"("bankId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRule_bankId_name_version_key" ON "PayoutRule"("bankId", "name", "version");

-- CreateIndex
CREATE INDEX "PayoutRate_ruleId_effectiveFrom_effectiveTo_idx" ON "PayoutRate"("ruleId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutEntitlement_eventKey_key" ON "PayoutEntitlement"("eventKey");

-- CreateIndex
CREATE INDEX "PayoutEntitlement_advisorUserId_state_idx" ON "PayoutEntitlement"("advisorUserId", "state");

-- CreateIndex
CREATE INDEX "PayoutEntitlement_leadId_idx" ON "PayoutEntitlement"("leadId");

-- CreateIndex
CREATE INDEX "PayoutEntitlement_state_eligibleAt_idx" ON "PayoutEntitlement"("state", "eligibleAt");

-- CreateIndex
CREATE INDEX "PayoutEntitlementEvent_entitlementId_at_idx" ON "PayoutEntitlementEvent"("entitlementId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_publicRef_key" ON "PayoutRequest"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_idempotencyKey_key" ON "PayoutRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayoutRequest_advisorUserId_state_idx" ON "PayoutRequest"("advisorUserId", "state");

-- CreateIndex
CREATE INDEX "PayoutRequest_managerApproverUserId_state_idx" ON "PayoutRequest"("managerApproverUserId", "state");

-- CreateIndex
CREATE INDEX "PayoutRequest_state_submittedAt_idx" ON "PayoutRequest"("state", "submittedAt");

-- CreateIndex
CREATE INDEX "PayoutRequestItem_requestId_idx" ON "PayoutRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "PayoutRequestItem_entitlementId_active_idx" ON "PayoutRequestItem"("entitlementId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutApproval_requestId_approverRole_key" ON "PayoutApproval"("requestId", "approverRole");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayment_requestId_key" ON "ExternalPayment"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayment_transferReference_key" ON "ExternalPayment"("transferReference");

-- CreateIndex
CREATE INDEX "StoredFile_purpose_createdAt_idx" ON "StoredFile"("purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_bucket_key_key" ON "StoredFile"("bucket", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_createdAt_idx" ON "OutboxEvent"("processedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLifecycleEvent" ADD CONSTRAINT "UserLifecycleEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLifecycleEvent" ADD CONSTRAINT "UserLifecycleEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingAssignment" ADD CONSTRAINT "ReportingAssignment_childUserId_fkey" FOREIGN KEY ("childUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingAssignment" ADD CONSTRAINT "ReportingAssignment_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingAssignment" ADD CONSTRAINT "ReportingAssignment_agentCodeId_fkey" FOREIGN KEY ("agentCodeId") REFERENCES "AgentCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCode" ADD CONSTRAINT "AgentCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfigHistory" ADD CONSTRAINT "SystemConfigHistory_key_fkey" FOREIGN KEY ("key") REFERENCES "SystemConfig"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfigHistory" ADD CONSTRAINT "SystemConfigHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensitiveAccessLog" ADD CONSTRAINT "SensitiveAccessLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhException" ADD CONSTRAINT "WfhException_telecallerUserId_fkey" FOREIGN KEY ("telecallerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhException" ADD CONSTRAINT "WfhException_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkAccessEvent" ADD CONSTRAINT "NetworkAccessEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkAccessEvent" ADD CONSTRAINT "NetworkAccessEvent_matchedNetworkId_fkey" FOREIGN KEY ("matchedNetworkId") REFERENCES "OfficeNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkAccessEvent" ADD CONSTRAINT "NetworkAccessEvent_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "WfhException"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingModule" ADD CONSTRAINT "TrainingModule_videoFileId_fkey" FOREIGN KEY ("videoFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingQuestion" ADD CONSTRAINT "TrainingQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_telecallerUserId_fkey" FOREIGN KEY ("telecallerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingModuleResult" ADD CONSTRAINT "TrainingModuleResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingModuleResult" ADD CONSTRAINT "TrainingModuleResult_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttempt" ADD CONSTRAINT "TrainingAttempt_moduleResultId_fkey" FOREIGN KEY ("moduleResultId") REFERENCES "TrainingModuleResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingReactivation" ADD CONSTRAINT "TrainingReactivation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingReactivation" ADD CONSTRAINT "TrainingReactivation_byManagerUserId_fkey" FOREIGN KEY ("byManagerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerImportBatch" ADD CONSTRAINT "CustomerImportBatch_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerImportBatch" ADD CONSTRAINT "CustomerImportBatch_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallingRecord" ADD CONSTRAINT "CallingRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CustomerImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallingRecord" ADD CONSTRAINT "CallingRecord_assignedTelecallerUserId_fkey" FOREIGN KEY ("assignedTelecallerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationEvent" ADD CONSTRAINT "AllocationEvent_callingRecordId_fkey" FOREIGN KEY ("callingRecordId") REFERENCES "CallingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_benefitPdfFileId_fkey" FOREIGN KEY ("benefitPdfFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardCategory" ADD CONSTRAINT "CreditCardCategory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardCategory" ADD CONSTRAINT "CreditCardCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CardCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationLink" ADD CONSTRAINT "ApplicationLink_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCodeCrosswalk" ADD CONSTRAINT "ProductCodeCrosswalk_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCodeCrosswalk" ADD CONSTRAINT "ProductCodeCrosswalk_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPincodeProfile" ADD CONSTRAINT "BankPincodeProfile_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPincodeBatch" ADD CONSTRAINT "BankPincodeBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BankPincodeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPincodeBatch" ADD CONSTRAINT "BankPincodeBatch_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPincodeBatch" ADD CONSTRAINT "BankPincodeBatch_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPincodeRow" ADD CONSTRAINT "BankPincodeRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BankPincodeBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPincodePublication" ADD CONSTRAINT "CardPincodePublication_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_callingRecordId_fkey" FOREIGN KEY ("callingRecordId") REFERENCES "CallingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_telecallerUserId_fkey" FOREIGN KEY ("telecallerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_callAttemptId_fkey" FOREIGN KEY ("callAttemptId") REFERENCES "CallAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOutcome" ADD CONSTRAINT "CallOutcome_callAttemptId_fkey" FOREIGN KEY ("callAttemptId") REFERENCES "CallAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOutcome" ADD CONSTRAINT "CallOutcome_callingRecordId_fkey" FOREIGN KEY ("callingRecordId") REFERENCES "CallingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOutcome" ADD CONSTRAINT "CallOutcome_telecallerUserId_fkey" FOREIGN KEY ("telecallerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOutcome" ADD CONSTRAINT "CallOutcome_selectedCardId_fkey" FOREIGN KEY ("selectedCardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallingInterest" ADD CONSTRAINT "CallingInterest_callingRecordId_fkey" FOREIGN KEY ("callingRecordId") REFERENCES "CallingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallingInterest" ADD CONSTRAINT "CallingInterest_telecallerUserId_fkey" FOREIGN KEY ("telecallerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallingInterest" ADD CONSTRAINT "CallingInterest_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallingInterest" ADD CONSTRAINT "CallingInterest_applicationLinkId_fkey" FOREIGN KEY ("applicationLinkId") REFERENCES "ApplicationLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_callingRecordId_fkey" FOREIGN KEY ("callingRecordId") REFERENCES "CallingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialIdCard" ADD CONSTRAINT "OfficialIdCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialIdCard" ADD CONSTRAINT "OfficialIdCard_renderedFileId_fkey" FOREIGN KEY ("renderedFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalRemark" ADD CONSTRAINT "OperationalRemark_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_chequeFileId_fkey" FOREIGN KEY ("chequeFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_advisorUserId_fkey" FOREIGN KEY ("advisorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadLinkInitiation" ADD CONSTRAINT "LeadLinkInitiation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadLinkInitiation" ADD CONSTRAINT "LeadLinkInitiation_applicationLinkId_fkey" FOREIGN KEY ("applicationLinkId") REFERENCES "ApplicationLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankApplicationLinkage" ADD CONSTRAINT "BankApplicationLinkage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankApplicationLinkage" ADD CONSTRAINT "BankApplicationLinkage_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_callingRecordId_fkey" FOREIGN KEY ("callingRecordId") REFERENCES "CallingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisImportProfile" ADD CONSTRAINT "MisImportProfile_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisImportBatch" ADD CONSTRAINT "MisImportBatch_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisImportBatch" ADD CONSTRAINT "MisImportBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MisImportProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisImportBatch" ADD CONSTRAINT "MisImportBatch_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisImportBatch" ADD CONSTRAINT "MisImportBatch_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisRow" ADD CONSTRAINT "MisRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MisImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisRow" ADD CONSTRAINT "MisRow_matchedLeadId_fkey" FOREIGN KEY ("matchedLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatusSnapshot" ADD CONSTRAINT "BankStatusSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatusSnapshot" ADD CONSTRAINT "BankStatusSnapshot_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatusSnapshot" ADD CONSTRAINT "BankStatusSnapshot_lastMatchedBatchId_fkey" FOREIGN KEY ("lastMatchedBatchId") REFERENCES "MisImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatusHistory" ADD CONSTRAINT "BankStatusHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatusHistory" ADD CONSTRAINT "BankStatusHistory_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MisImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatusHistory" ADD CONSTRAINT "BankStatusHistory_misRowId_fkey" FOREIGN KEY ("misRowId") REFERENCES "MisRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRule" ADD CONSTRAINT "PayoutRule_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRate" ADD CONSTRAINT "PayoutRate_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PayoutRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_advisorUserId_fkey" FOREIGN KEY ("advisorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PayoutRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "PayoutRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_evidenceBatchId_fkey" FOREIGN KEY ("evidenceBatchId") REFERENCES "MisImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlement" ADD CONSTRAINT "PayoutEntitlement_evidenceMisRowId_fkey" FOREIGN KEY ("evidenceMisRowId") REFERENCES "MisRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEntitlementEvent" ADD CONSTRAINT "PayoutEntitlementEvent_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "PayoutEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_advisorUserId_fkey" FOREIGN KEY ("advisorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequestItem" ADD CONSTRAINT "PayoutRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PayoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequestItem" ADD CONSTRAINT "PayoutRequestItem_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "PayoutEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutApproval" ADD CONSTRAINT "PayoutApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PayoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutApproval" ADD CONSTRAINT "PayoutApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPayment" ADD CONSTRAINT "ExternalPayment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PayoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPayment" ADD CONSTRAINT "ExternalPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPayment" ADD CONSTRAINT "ExternalPayment_proofFileId_fkey" FOREIGN KEY ("proofFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
