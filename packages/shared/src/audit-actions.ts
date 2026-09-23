/**
 * F-704 / REQ-24 §24.3 — audit action catalogue. Each group is one REQ-24 §24.3 (and REQ-16 §16.2 audit dashboard)
 * category; every key is an `@Audited({ action })` value written by the API, so the dashboard can filter by it.
 */
export const AUDIT_ACTION_GROUPS = {
  uploads: { label: 'Uploads (accepted / rejected)', actions: ['files.upload', 'files.quarantine', 'files.rescan', 'customerBatch.create', 'customerBatch.confirm', 'misBatch.create', 'pincodeBatch.create', 'pincodeBatch.confirm', 'pincodeMaster.import', 'suppression.import'] },
  mappingRevisions: { label: 'Mapping revisions', actions: ['customerBatch.mapping', 'misProfile.update', 'misProfile.approve', 'misProfile.acknowledgeValues', 'pincodeProfile.update', 'pincodeProfile.approve', 'crosswalk.upsert'] },
  leadReferenceLinkage: { label: 'Lead reference linkage', actions: ['lead.create', 'lead.bankReference', 'lead.linkShare', 'lead.linkOpen'] },
  bankStatusChanges: { label: 'Bank status changes (MIS apply / resolve)', actions: ['misBatch.preview', 'misBatch.apply', 'misBatch.previewCompleted', 'misBatch.applyCompleted', 'misBatch.jobFailed', 'misBatch.reject', 'misRow.resolve'] },
  assignmentsAndWfh: { label: 'Telecaller assignment & WFH', actions: ['allocation.run', 'allocation.reassign', 'hierarchy.reassign', 'wfh.grant', 'wfh.revoke'] },
  trainingReactivation: { label: 'Training expiry & reactivation', actions: ['training.expire', 'training.reactivate', 'training.module.publish', 'training.module.update'] },
  payoutDecisions: { label: 'Payout rules & decisions', actions: ['payoutRule.create', 'payoutRule.approve', 'payoutRule.retire', 'payoutRate.create', 'payoutRate.approve', 'payoutRequest.create', 'payoutRequest.decide', 'payoutRequest.cancel', 'payouts.reevaluate', 'payoutException.resolve'] },
  manualPayments: { label: 'Manual payments', actions: ['payment.record', 'payment.proof', 'payment.correct', 'payment.correctionDecision', 'payment.flag', 'payment.resolve'] },
  userManagement: { label: 'User management & hierarchy', actions: ['users.create', 'users.deactivate', 'users.reactivate', 'users.sessions.revoke', 'users.changeMobile', 'security.deviceIntegrity', 'telecallers.create', 'agentCode.create', 'agentCode.revoke', 'hierarchy.applyCode', 'hierarchy.approve', 'hierarchy.reject', 'onboarding.review'] },
  catalogueAndLinks: { label: 'Catalogue & link versions', actions: ['bank.create', 'bank.update', 'card.create', 'card.update', 'card.publish', 'card.retire', 'cardPublication.create', 'cardPublication.end', 'applicationLink.create', 'applicationLink.end'] },
  configuration: { label: 'Configuration & compliance', actions: ['config.update', 'audit.export', 'outbox.relay', 'network.add', 'network.setActive', 'suppression.add', 'suppression.lift'] },
  retention: { label: 'Retention & legal hold', actions: ['retention.execute', 'retention.purgeFile', 'retention.restrictRecord', 'legalHold.set'] },
} as const;
export type AuditActionGroup = keyof typeof AUDIT_ACTION_GROUPS;
export const ALL_AUDIT_ACTIONS: readonly string[] = Object.values(AUDIT_ACTION_GROUPS).flatMap((g) => g.actions);
