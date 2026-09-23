/**
 * F-701 / REQ-19 §19.2, REQ-14 §14.6 — wording for MIS notifications. Cites the raw field that changed, the raw value
 * and the batch; never says "approved" or "activated" on its own — the bank's words are quoted verbatim.
 */
export const MIS_NOTIFY_FIELD_LABEL: Record<string, string> = {
  currentStage: 'Current stage',
  finalDecision: 'Final decision',
  cardActivationStatus: 'Card activation',
  ipaStatus: 'IPA status',
  kycStatus: 'KYC status',
  vkycStatus: 'VKYC status',
  bkycStatus: 'BKYC status',
  kycSuccessNr: 'KYC success/NR',
  dropoffReason: 'Drop-off reason',
  declineCode: 'Decline code',
  declineDescription: 'Decline description',
  declineType: 'Decline type',
  reason: 'Reason',
  curableFlag: 'Curable flag',
};

export function misChangeLine(field: string, raw: string | null | undefined): string {
  const value = raw === null || raw === undefined || raw.trim() === '' ? 'not reported' : `"${raw.trim()}"`;
  if (field === 'cardActivationStatus') return `Card activation reported as ${value}`;
  return `${MIS_NOTIFY_FIELD_LABEL[field] ?? field} = ${value}`;
}

/** "Bank MIS updated (batch KBS-B-…, 22 Sep 2026): Final decision = "Approve"; Card activation reported as "INACTIVE"" */
export function misChangeBody(input: { kbsRef: string; batchRef: string; batchDate: string; changes: { field: string; value: string | null }[]; firstMatch?: boolean }): string {
  const lines = input.changes.map((c) => misChangeLine(c.field, c.value));
  const head = input.firstMatch ? `${input.kbsRef} matched in bank MIS (batch ${input.batchRef}, ${input.batchDate})` : `Bank MIS updated ${input.kbsRef} (batch ${input.batchRef}, ${input.batchDate})`;
  return lines.length ? `${head}: ${lines.join('; ')}` : head;
}
