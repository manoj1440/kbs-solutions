-- F-605 invariants (INV-06, REQ-17 §17.7, REQ-18 §18.3). Separate migration because new enum values
-- cannot be referenced in the transaction that adds them.

-- One live payment record per request, corrections replace it only through the audited workflow.
CREATE UNIQUE INDEX "ExternalPayment_one_live_per_request_idx" ON "ExternalPayment" ("requestId")
  WHERE state IN ('RECORDED', 'PROOF_PENDING', 'VERIFIED', 'EXCEPTION');

-- A bank transfer reference can back only one live payment across all requests.
CREATE UNIQUE INDEX "ExternalPayment_live_reference_idx" ON "ExternalPayment" ("transferReferenceKey")
  WHERE state IN ('RECORDED', 'PROOF_PENDING', 'VERIFIED', 'EXCEPTION');

-- At most one correction awaiting Admin approval per request.
CREATE UNIQUE INDEX "ExternalPayment_one_pending_correction_idx" ON "ExternalPayment" ("requestId")
  WHERE state = 'CORRECTION_PENDING';
