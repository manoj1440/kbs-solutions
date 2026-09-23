/**
 * Canonical enums for the whole platform. Mirrored 1:1 in packages/db/prisma/schema.prisma
 * (a test in @kbs/db asserts they stay in sync). Values are stable strings stored in the DB.
 */
export const Role = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  TELECALLER: 'TELECALLER',
  ADVISOR: 'ADVISOR',
  ACCOUNTS: 'ACCOUNTS',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = Object.values(Role) as Role[];

export const UserStatus = {
  PENDING_ONBOARDING: 'PENDING_ONBOARDING',
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED',
  BLOCKED: 'BLOCKED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const Platform = { ANDROID: 'ANDROID', WEB: 'WEB' } as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const OtpPurpose = { LOGIN: 'LOGIN', ADVISOR_SIGNUP: 'ADVISOR_SIGNUP' } as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

/** Who asserted a value. Rendered as a chip next to every status (REQ-20 §20.3). */
export const Provenance = {
  BANK_MIS: 'BANK_MIS',
  KBS_OPERATIONAL: 'KBS_OPERATIONAL',
  KBS_PAYMENT: 'KBS_PAYMENT',
} as const;
export type Provenance = (typeof Provenance)[keyof typeof Provenance];

export const UserLifecycleEventType = {
  CREATED: 'CREATED',
  ACTIVATED: 'ACTIVATED',
  DEACTIVATED: 'DEACTIVATED',
  BLOCKED: 'BLOCKED',
  REACTIVATED: 'REACTIVATED',
  MOBILE_CHANGED: 'MOBILE_CHANGED',
} as const;
export type UserLifecycleEventType = (typeof UserLifecycleEventType)[keyof typeof UserLifecycleEventType];

export const ReportingSource = {
  MANAGER_CREATED_TELECALLER: 'MANAGER_CREATED_TELECALLER',
  AGENT_CODE: 'AGENT_CODE',
  ADMIN_DEFAULT: 'ADMIN_DEFAULT',
  ADMIN_REASSIGNED: 'ADMIN_REASSIGNED',
} as const;
export type ReportingSource = (typeof ReportingSource)[keyof typeof ReportingSource];

export const ReportingAssignmentStatus = {
  ACTIVE: 'ACTIVE',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
} as const;
export type ReportingAssignmentStatus = (typeof ReportingAssignmentStatus)[keyof typeof ReportingAssignmentStatus];

export const AgentCodeStatus = { ACTIVE: 'ACTIVE', REVOKED: 'REVOKED' } as const;
export type AgentCodeStatus = (typeof AgentCodeStatus)[keyof typeof AgentCodeStatus];

export const ConfigValueType = {
  STRING: 'STRING',
  INT: 'INT',
  BOOL: 'BOOL',
  JSON: 'JSON',
  USER_ID: 'USER_ID',
  DURATION: 'DURATION',
} as const;
export type ConfigValueType = (typeof ConfigValueType)[keyof typeof ConfigValueType];

export const SensitiveField = {
  PAN: 'PAN',
  MOBILE: 'MOBILE',
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  RECORDING: 'RECORDING',
  CHEQUE: 'CHEQUE',
  PROOF: 'PROOF',
  AADHAAR_RESULT: 'AADHAAR_RESULT',
  MIS_RAW_ROW: 'MIS_RAW_ROW',
  ID_CARD: 'ID_CARD',
} as const;
export type SensitiveField = (typeof SensitiveField)[keyof typeof SensitiveField];

export const NetworkAccessOutcome = {
  ALLOWED_OFFICE: 'ALLOWED_OFFICE',
  ALLOWED_WFH: 'ALLOWED_WFH',
  DENIED: 'DENIED',
} as const;
export type NetworkAccessOutcome = (typeof NetworkAccessOutcome)[keyof typeof NetworkAccessOutcome];

export const TrainingEnrollmentStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PASSED: 'PASSED',
  EXPIRED_DEACTIVATED: 'EXPIRED_DEACTIVATED',
  REACTIVATED_IN_PROGRESS: 'REACTIVATED_IN_PROGRESS',
} as const;
export type TrainingEnrollmentStatus = (typeof TrainingEnrollmentStatus)[keyof typeof TrainingEnrollmentStatus];

export const ModuleResultStatus = {
  LOCKED: 'LOCKED',
  IN_PROGRESS: 'IN_PROGRESS',
  PASSED: 'PASSED',
} as const;
export type ModuleResultStatus = (typeof ModuleResultStatus)[keyof typeof ModuleResultStatus];

export const TrainingModuleStatus = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED' } as const;
export type TrainingModuleStatus = (typeof TrainingModuleStatus)[keyof typeof TrainingModuleStatus];

export const ImportBatchStatus = {
  UPLOADED: 'UPLOADED',
  VALIDATED: 'VALIDATED',
  IMPORTED: 'IMPORTED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
} as const;
export type ImportBatchStatus = (typeof ImportBatchStatus)[keyof typeof ImportBatchStatus];

export const InteractionStatus = {
  UNTOUCHED: 'UNTOUCHED',
  FOLLOW_UP: 'FOLLOW_UP',
  INTERESTED: 'INTERESTED',
  LINK_SHARED: 'LINK_SHARED',
  DECLINED: 'DECLINED',
  COMPLETED: 'COMPLETED',
  UNREACHABLE: 'UNREACHABLE',
} as const;
export type InteractionStatus = (typeof InteractionStatus)[keyof typeof InteractionStatus];

export const RecordReviewStatus = {
  ACCEPTED: 'ACCEPTED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  EXCLUDED: 'EXCLUDED',
} as const;
export type RecordReviewStatus = (typeof RecordReviewStatus)[keyof typeof RecordReviewStatus];

export const SuppressionReason = {
  CUSTOMER_REQUEST: 'CUSTOMER_REQUEST',
  COMPLIANCE: 'COMPLIANCE',
  DND_LIST: 'DND_LIST',
} as const;
export type SuppressionReason = (typeof SuppressionReason)[keyof typeof SuppressionReason];

export const CardStatus = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', RETIRED: 'RETIRED' } as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

export const Channel = { TELECALLER: 'TELECALLER', ADVISOR: 'ADVISOR', BOTH: 'BOTH' } as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

export const ProfileStatus = { DRAFT: 'DRAFT', APPROVED: 'APPROVED', RETIRED: 'RETIRED' } as const;
export type ProfileStatus = (typeof ProfileStatus)[keyof typeof ProfileStatus];

export const Sourceability = {
  SOURCEABLE: 'SOURCEABLE',
  NOT_SOURCEABLE: 'NOT_SOURCEABLE',
  REQUIRES_BANK_MAPPING: 'REQUIRES_BANK_MAPPING',
} as const;
export type Sourceability = (typeof Sourceability)[keyof typeof Sourceability];

export const CallProviderState = {
  REQUESTED: 'REQUESTED',
  RINGING: 'RINGING',
  CONNECTED: 'CONNECTED',
  ENDED: 'ENDED',
  FAILED: 'FAILED',
  NO_ANSWER: 'NO_ANSWER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type CallProviderState = (typeof CallProviderState)[keyof typeof CallProviderState];

export const RecordingStatus = {
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
  PENDING: 'PENDING',
  AVAILABLE: 'AVAILABLE',
  FAILED: 'FAILED',
} as const;
export type RecordingStatus = (typeof RecordingStatus)[keyof typeof RecordingStatus];

export const CallOutcome = {
  NO_ANSWER_OR_FAILED: 'NO_ANSWER_OR_FAILED',
  CONNECTED_INTERESTED: 'CONNECTED_INTERESTED',
  CONNECTED_LINK_OR_PDF_SHARED: 'CONNECTED_LINK_OR_PDF_SHARED',
  FOLLOW_UP: 'FOLLOW_UP',
  DECLINED: 'DECLINED',
  COMPLETED_NO_FURTHER: 'COMPLETED_NO_FURTHER',
} as const;
export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome];

export const ShareKind = {
  BENEFIT_PDF: 'BENEFIT_PDF',
  OFFICE_ID: 'OFFICE_ID',
  APPLICATION_LINK: 'APPLICATION_LINK',
} as const;
export type ShareKind = (typeof ShareKind)[keyof typeof ShareKind];

export const ShareChannel = {
  WHATSAPP_HANDOFF: 'WHATSAPP_HANDOFF',
  WHATSAPP_BUSINESS_API: 'WHATSAPP_BUSINESS_API',
} as const;
export type ShareChannel = (typeof ShareChannel)[keyof typeof ShareChannel];

export const HandoffResult = { OPENED: 'OPENED', FAILED: 'FAILED' } as const;
export type HandoffResult = (typeof HandoffResult)[keyof typeof HandoffResult];

export const DeliveryStatus = {
  UNKNOWN: 'UNKNOWN',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const OnboardingStep = {
  PERSONAL: 'PERSONAL',
  CONSENT: 'CONSENT',
  IDENTITY: 'IDENTITY',
  BANK: 'BANK',
  CHEQUE: 'CHEQUE',
  AGENT_CODE: 'AGENT_CODE',
  REVIEW: 'REVIEW',
  AWAITING_REVIEW: 'AWAITING_REVIEW',
  COMPLETE: 'COMPLETE',
} as const;
export type OnboardingStep = (typeof OnboardingStep)[keyof typeof OnboardingStep];

export const VerificationStatus = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  MISMATCH: 'MISMATCH',
  FAILED: 'FAILED',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const ReviewOutcome = { APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
export type ReviewOutcome = (typeof ReviewOutcome)[keyof typeof ReviewOutcome];

export const EmploymentType = {
  SALARIED: 'SALARIED',
  SELF_EMPLOYED: 'SELF_EMPLOYED',
  SELF_EMPLOYED_PROFESSIONAL: 'SELF_EMPLOYED_PROFESSIONAL',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

export const LinkAction = { SHARED: 'SHARED', OPENED: 'OPENED' } as const;
export type LinkAction = (typeof LinkAction)[keyof typeof LinkAction];

export const BankReferenceKind = {
  APPLICATION_NO: 'APPLICATION_NO',
  APPLICATION_REFERENCE_NUMBER: 'APPLICATION_REFERENCE_NUMBER',
  OTHER: 'OTHER',
} as const;
export type BankReferenceKind = (typeof BankReferenceKind)[keyof typeof BankReferenceKind];

export const LinkageSource = {
  ADVISOR_ENTERED: 'ADVISOR_ENTERED',
  ADMIN_ENTERED: 'ADMIN_ENTERED',
  ISSUER_CALLBACK: 'ISSUER_CALLBACK',
  MIS_RESOLVED_BY_ADMIN: 'MIS_RESOLVED_BY_ADMIN',
} as const;
export type LinkageSource = (typeof LinkageSource)[keyof typeof LinkageSource];

export const LinkageVerification = {
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED_BY_MIS_MATCH: 'VERIFIED_BY_MIS_MATCH',
  REJECTED: 'REJECTED',
} as const;
export type LinkageVerification = (typeof LinkageVerification)[keyof typeof LinkageVerification];

export const MisSnapshotMode = { DELTA: 'DELTA', FULL_SNAPSHOT: 'FULL_SNAPSHOT' } as const;
export type MisSnapshotMode = (typeof MisSnapshotMode)[keyof typeof MisSnapshotMode];

export const MisBatchStage = {
  UPLOADED: 'UPLOADED',
  PARSED: 'PARSED',
  MAPPED: 'MAPPED',
  PREVIEWED: 'PREVIEWED',
  APPLYING: 'APPLYING',
  APPLIED: 'APPLIED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
} as const;
export type MisBatchStage = (typeof MisBatchStage)[keyof typeof MisBatchStage];

/** F-508 background MIS jobs. */
export const MisJobKind = { PREVIEW: 'PREVIEW', APPLY: 'APPLY' } as const;
export type MisJobKind = (typeof MisJobKind)[keyof typeof MisJobKind];
export const MisJobStatus = { QUEUED: 'QUEUED', RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED' } as const;
export type MisJobStatus = (typeof MisJobStatus)[keyof typeof MisJobStatus];

export const MisRowMatchState = {
  PENDING: 'PENDING',
  MATCHED: 'MATCHED',
  UNMATCHED: 'UNMATCHED',
  CONFLICT: 'CONFLICT',
  INVALID: 'INVALID',
  DUPLICATE_IN_BATCH: 'DUPLICATE_IN_BATCH',
  IGNORED: 'IGNORED',
} as const;
export type MisRowMatchState = (typeof MisRowMatchState)[keyof typeof MisRowMatchState];

export const BankStatusChangeKind = {
  SET: 'SET',
  CHANGED: 'CHANGED',
  CONFIRMED_SAME: 'CONFIRMED_SAME',
  REPORTED_BLANK: 'REPORTED_BLANK',
  ABSENT_FROM_BATCH: 'ABSENT_FROM_BATCH',
} as const;
export type BankStatusChangeKind = (typeof BankStatusChangeKind)[keyof typeof BankStatusChangeKind];

export const RuleStatus = { DRAFT: 'DRAFT', APPROVED: 'APPROVED', RETIRED: 'RETIRED' } as const;
export type RuleStatus = (typeof RuleStatus)[keyof typeof RuleStatus];

export const PayoutEntitlementState = {
  PENDING_HOLD: 'PENDING_HOLD',
  ELIGIBLE_AVAILABLE: 'ELIGIBLE_AVAILABLE',
  RESERVED: 'RESERVED',
  PAID: 'PAID',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VOID: 'VOID',
} as const;
export type PayoutEntitlementState = (typeof PayoutEntitlementState)[keyof typeof PayoutEntitlementState];

export const PayoutRequestState = {
  PENDING_APPROVALS: 'PENDING_APPROVALS',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  PAYMENT_RECORDED_PENDING_PROOF: 'PAYMENT_RECORDED_PENDING_PROOF',
  PAID: 'PAID',
  ON_HOLD: 'ON_HOLD',
} as const;
export type PayoutRequestState = (typeof PayoutRequestState)[keyof typeof PayoutRequestState];

export const ApprovalRole = { MANAGER: 'MANAGER', ADMIN: 'ADMIN' } as const;
export type ApprovalRole = (typeof ApprovalRole)[keyof typeof ApprovalRole];

export const ApprovalDecision = { APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

export const ExternalPaymentState = {
  RECORDED: 'RECORDED',
  PROOF_PENDING: 'PROOF_PENDING',
  VERIFIED: 'VERIFIED',
  EXCEPTION: 'EXCEPTION',
  CORRECTION_PENDING: 'CORRECTION_PENDING',
  SUPERSEDED: 'SUPERSEDED',
  CORRECTION_REJECTED: 'CORRECTION_REJECTED',
} as const;
export type ExternalPaymentState = (typeof ExternalPaymentState)[keyof typeof ExternalPaymentState];

export const FilePurpose = {
  CUSTOMER_LIST: 'CUSTOMER_LIST',
  BANK_PINCODE: 'BANK_PINCODE',
  PINCODE_MASTER: 'PINCODE_MASTER',
  MIS: 'MIS',
  TRAINING_VIDEO: 'TRAINING_VIDEO',
  CARD_IMAGE: 'CARD_IMAGE',
  BENEFIT_PDF: 'BENEFIT_PDF',
  CHEQUE: 'CHEQUE',
  PAYMENT_PROOF: 'PAYMENT_PROOF',
  ID_CARD: 'ID_CARD',
  RECORDING: 'RECORDING',
  DND_LIST: 'DND_LIST',
} as const;
export type FilePurpose = (typeof FilePurpose)[keyof typeof FilePurpose];

export const FileScanStatus = {
  PENDING: 'PENDING',
  CLEAN: 'CLEAN',
  INFECTED: 'INFECTED',
  SKIPPED: 'SKIPPED',
} as const;
export type FileScanStatus = (typeof FileScanStatus)[keyof typeof FileScanStatus];

export const NotificationKind = {
  ASSIGNMENT_NEW: 'ASSIGNMENT_NEW',
  TRAINING_DEADLINE: 'TRAINING_DEADLINE',
  TRAINING_DEACTIVATED: 'TRAINING_DEACTIVATED',
  TRAINING_REACTIVATED: 'TRAINING_REACTIVATED',
  TRAINING_PASSED: 'TRAINING_PASSED',
  WFH_GRANTED: 'WFH_GRANTED',
  WFH_REVOKED: 'WFH_REVOKED',
  FOLLOW_UP_DUE: 'FOLLOW_UP_DUE',
  RECORDING_STATUS: 'RECORDING_STATUS',
  ONBOARDING_ISSUE: 'ONBOARDING_ISSUE',
  ONBOARDING_APPROVED: 'ONBOARDING_APPROVED',
  LEAD_CREATED: 'LEAD_CREATED',
  MIS_MATCHED: 'MIS_MATCHED',
  MIS_CHANGED: 'MIS_CHANGED',
  MIS_IMPORT_RESULT: 'MIS_IMPORT_RESULT',
  PAYOUT_ELIGIBLE: 'PAYOUT_ELIGIBLE',
  PAYOUT_SUBMITTED: 'PAYOUT_SUBMITTED',
  PAYOUT_APPROVAL_REQUIRED: 'PAYOUT_APPROVAL_REQUIRED',
  PAYOUT_DECISION: 'PAYOUT_DECISION',
  PAYOUT_READY_FOR_PAYMENT: 'PAYOUT_READY_FOR_PAYMENT',
  PAYOUT_PAID: 'PAYOUT_PAID',
  PAYOUT_EXCEPTION: 'PAYOUT_EXCEPTION',
  SECURITY_EVENT: 'SECURITY_EVENT',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];
