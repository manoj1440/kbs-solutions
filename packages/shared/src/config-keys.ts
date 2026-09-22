import { ConfigValueType } from './enums';

export interface ConfigKeyDefinition {
  key: string;
  valueType: ConfigValueType;
  /** Default value; `null` means "unset" and, if requiresValueBeforeProd, blocks the launch gate. */
  defaultValue: unknown;
  description: string;
  requiresValueBeforeProd: boolean;
}

const def = (
  key: string,
  valueType: ConfigValueType,
  defaultValue: unknown,
  description: string,
  requiresValueBeforeProd = false,
): ConfigKeyDefinition => ({ key, valueType, defaultValue, description, requiresValueBeforeProd });

/**
 * Every Admin-configurable value the PRD asks for (F-104). ★ = requiresValueBeforeProd (REQ-28 §28.2 launch gate).
 * Keys are stable identifiers; changing a default here does NOT change an already-seeded database.
 */
export const CONFIG_KEYS: readonly ConfigKeyDefinition[] = [
  // auth
  def('auth.otp.expirySec', ConfigValueType.INT, 300, 'OTP validity in seconds (REQ-04 §4.1).'),
  def('auth.otp.resendCooldownSec', ConfigValueType.INT, 60, 'Minimum seconds between OTP sends to the same mobile.'),
  def('auth.otp.maxSendsPerMobilePerHour', ConfigValueType.INT, 10, 'OTP send rate limit per mobile per hour.'),
  def('auth.otp.maxSendsPerIpPerHour', ConfigValueType.INT, 30, 'OTP send rate limit per IP per hour.'),
  def('auth.otp.maxAttempts', ConfigValueType.INT, 5, 'Wrong-code attempts before the mobile is locked.'),
  def('auth.otp.lockMinutes', ConfigValueType.INT, 15, 'Lock duration after too many wrong attempts.'),
  def('auth.accessTokenMinutes', ConfigValueType.INT, 15, 'Access token lifetime.'),
  def('auth.refreshTokenDays', ConfigValueType.INT, 30, 'Refresh token lifetime (rotating).'),
  def('auth.telecallerSingleSession', ConfigValueType.BOOL, true, 'A new Telecaller login revokes previous sessions.'),
  def('auth.webAccessRoles', ConfigValueType.JSON, ['ADMIN', 'MANAGER', 'ACCOUNTS'], 'Roles allowed to log in on the web app (REQ-02 §2.3).'),
  def('auth.recoveryEnabled', ConfigValueType.BOOL, false, 'Enable Admin-side mobile-number change for lost/changed phones (policy OPEN, REQ-04 §4.1).', true),
  // training
  def('training.windowHours', ConfigValueType.INT, 72, 'Training window from first successful login (REQ-05 §5.1).'),
  def('training.passRule', ConfigValueType.STRING, 'PER_MODULE_THRESHOLD', 'PER_MODULE_THRESHOLD or AVERAGE_ACROSS_MODULES (REQ-05 §5.3 OPEN).'),
  def('training.defaultPassThresholdPct', ConfigValueType.INT, 70, 'Default pass threshold % for modules (REQ-05 §5.3 OPEN — confirm with KBS).', true),
  def('training.attemptLimit', ConfigValueType.INT, null, 'Max attempts per module; null = unlimited (OPEN).'),
  def('training.videoCompletionRequired', ConfigValueType.BOOL, true, 'Video must be completed before the assessment (OPEN).'),
  def('training.shuffleQuestions', ConfigValueType.BOOL, true, 'Shuffle MCQs and options per attempt (OPEN).'),
  def('training.reactivationWindowHours', ConfigValueType.INT, null, 'New window after Manager reactivation; null = not configured → gate stays closed (REQ-05 §5.4 OPEN).', true),
  // allocation
  def('allocation.algorithm', ConfigValueType.STRING, 'ROUND_ROBIN_EQUAL', 'ROUND_ROBIN_EQUAL | WEIGHTED_BY_CAPACITY | REGION_PREFERRED (REQ-06 §6.4 OPEN).'),
  def('allocation.maxActivePerTelecaller', ConfigValueType.INT, null, 'Max active records per Telecaller; null = no cap.'),
  def('allocation.businessHoursOnly', ConfigValueType.BOOL, false, 'Only allocate during business hours.'),
  def('allocation.regionPreferences', ConfigValueType.JSON, {}, 'REGION_PREFERRED only: map of Telecaller employeeCode → preferred states[] (e.g. {"TC001":["RAJASTHAN"]}).'),
  def('allocation.dedupeKey', ConfigValueType.JSON, ['mobile'], 'Fields forming the duplicate-identity key for calling records (REQ-06 §6.3 OPEN).', true),
  // network
  def('network.enforceForTelecallers', ConfigValueType.BOOL, true, 'Enforce office-network policy for Telecallers (REQ-09 §9.1).'),
  def('network.allowEmptyAllowlist', ConfigValueType.BOOL, false, 'If false, an empty allowlist blocks all Telecallers (fail closed).'),
  // calling
  def('calling.requireReasonForFollowUp', ConfigValueType.BOOL, true, 'Require notes when outcome is follow-up (REQ-08 §8.6).'),
  def('calling.requireReasonForDecline', ConfigValueType.BOOL, true, 'Require notes when outcome is declined (REQ-08 §8.6).'),
  def('calling.outcomeTaxonomyVersion', ConfigValueType.INT, 1, 'Version of the operational outcome taxonomy.'),
  // mis
  def('mis.blankValueTokens', ConfigValueType.JSON, ['', '#N/A', 'N/A', 'NA', '-', '#REF!', 'NULL'], 'Cell values treated as blank / not reported (INV-02).'),
  def('mis.actionableRules', ConfigValueType.JSON, [], 'Per-bank rules that turn MIS fields into pending actions with owner/CTA (REQ-11 §11.10). Empty = none.'),
  // payouts
  def('payouts.designatedApproverManagerUserId', ConfigValueType.USER_ID, null, 'Manager who gives the Manager approval for Advisors reporting directly to Admin (REQ-17 §17.4 OPEN).', true),
  def('payouts.approvalOrder', ConfigValueType.STRING, 'ANY', 'ANY | MANAGER_FIRST (REQ-17 §17.5).'),
  def('payouts.proofRequiredForPaid', ConfigValueType.BOOL, true, 'Payment proof mandatory to mark a request Paid (REQ-18).'),
  def('payouts.requestStaleDays', ConfigValueType.INT, 30, 'Pending requests older than this are flagged as exceptions.'),
  def('payouts.advisorCanCancelBeforeApproval', ConfigValueType.BOOL, true, 'Advisor may cancel a request before any approval.'),
  // hierarchy
  def('hierarchy.agentCodeChangeRequiresAdminApproval', ConfigValueType.BOOL, true, 'Agent Code change after leads exist needs Admin approval (REQ-10 §10.4 OPEN).'),
  def('hierarchy.agentCodeFormat', ConfigValueType.STRING, '^[A-Z0-9]{4,12}$', 'Regex for Agent Codes (OPEN).'),
  // files
  def('files.maxUploadMb', ConfigValueType.INT, 25, 'Max upload size in MB.'),
  def('files.requireCleanScanForNonAdmin', ConfigValueType.BOOL, true, 'Non-Admin roles can only access files with scanStatus=CLEAN.'),
  def('files.presignExpirySec', ConfigValueType.INT, 300, 'Presigned download URL validity.'),
  // onboarding / leads
  def('onboarding.requiresAdminReview', ConfigValueType.BOOL, true, 'Advisor account activates only after Admin review (REQ-10 §10.1).'),
  def('onboarding.collectAdvisorPan', ConfigValueType.BOOL, false, 'Collect Advisor PAN during onboarding (REQ-10 §10.3 OPEN).'),
  def('leads.allowUnverifiedPan', ConfigValueType.BOOL, false, 'Allow lead submission when PAN verification is unavailable (REQ-11 §11.4 OPEN).'),
  def('leads.declarations', ConfigValueType.JSON, [], 'Versioned declaration texts the customer must accept (REQ-11 §11.4). Empty = lead creation blocked.', true),
  // catalogue
  def('catalogue.forbiddenPhrases', ConfigValueType.JSON, ['guaranteed approval', 'instant approval', 'assured approval', 'eligible for sure'], 'Marketing phrases blocked in card copy (REQ-11 §11.3).'),
  // compliance
  def('compliance.callingListConsentConfirmedByCompliance', ConfigValueType.BOOL, false, 'KBS compliance has confirmed purchased-list consent/DND SOP (REQ-21 §21.2).', true),
  def('compliance.recordingDisclosureText', ConfigValueType.STRING, null, 'Disclosure script shown before dialing (REQ-21 §21.3).', true),
  def('compliance.whatsappConsentPolicy', ConfigValueType.STRING, null, 'Approved WhatsApp consent/template policy (REQ-08 §8.5).', true),
  // retention
  def('retention.callingRecordsDays', ConfigValueType.INT, null, 'Retention for calling records (REQ-21 §21.5 OPEN).', true),
  def('retention.recordingsDays', ConfigValueType.INT, null, 'Retention for call recordings (OPEN).', true),
  def('retention.misFilesDays', ConfigValueType.INT, null, 'Retention for MIS source files (OPEN).', true),
  def('retention.documentsDays', ConfigValueType.INT, null, 'Retention for cheques/proofs/ID cards (OPEN).', true),
  // idcard, ux, support, audit
  def('idcard.fields', ConfigValueType.JSON, ['fullName', 'employeeCode', 'role', 'issuedAt', 'verifyUrl'], 'Fields rendered on the official ID card (REQ-08 §8.4 OPEN).'),
  def('ux.timezone', ConfigValueType.STRING, 'Asia/Kolkata', 'Display timezone.'),
  def('support.contact', ConfigValueType.STRING, null, 'Support contact shown in profiles.'),
  def('audit.exportEnabled', ConfigValueType.BOOL, false, 'Allow audit export downloads (policy OPEN).'),
];

export const CONFIG_KEY_MAP: ReadonlyMap<string, ConfigKeyDefinition> = new Map(CONFIG_KEYS.map((k) => [k.key, k]));
