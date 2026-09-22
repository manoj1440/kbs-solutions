-- Constraints Prisma's schema language cannot express (see DOCS/architecture/03-data-model.md §12).

-- ADR-011 / REQ-03 §3.1: exactly one Admin.
CREATE UNIQUE INDEX "User_single_admin_idx" ON "User" ((role)) WHERE role = 'ADMIN';

-- One open reporting assignment per child (effective-dated hierarchy).
CREATE UNIQUE INDEX "ReportingAssignment_one_open_per_child_idx" ON "ReportingAssignment" ("childUserId")
  WHERE "effectiveTo" IS NULL AND status = 'ACTIVE';

-- INV-06: a payable card event can sit in at most one active payout request.
CREATE UNIQUE INDEX "PayoutRequestItem_one_active_per_entitlement_idx" ON "PayoutRequestItem" ("entitlementId")
  WHERE active = true;

-- One current (non-superseded) linkage per lead+kind keeps the matcher deterministic.
CREATE UNIQUE INDEX "BankApplicationLinkage_current_per_lead_kind_idx" ON "BankApplicationLinkage" ("leadId", "referenceKind")
  WHERE "supersededAt" IS NULL;

-- Only one non-revoked official ID card per user.
CREATE UNIQUE INDEX "OfficialIdCard_one_active_per_user_idx" ON "OfficialIdCard" ("userId") WHERE "revokedAt" IS NULL;

-- Only one effective application link per card+channel at a time (open-ended rows).
CREATE UNIQUE INDEX "ApplicationLink_one_open_per_card_channel_idx" ON "ApplicationLink" ("cardId", "channel")
  WHERE "effectiveTo" IS NULL;

-- Append-only protection of audit tables at the database-role level is added in F-903 (hardening),
-- because migration scripts here must stay single-statement SQL (no DO blocks).
