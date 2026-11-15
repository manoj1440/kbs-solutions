-- F-824 (owner decision 2026-11-15): the Advisor whose Agent Code another Advisor signed up with is paid a share through
-- KBS. One activated card can therefore carry two payable items: the lead's own Advisor (OWN) and the Advisor that
-- Advisor reported to when the lead was created (REFERRAL). Additive only; every existing row is OWN.
-- CreateEnum
CREATE TYPE "PayoutEntitlementKind" AS ENUM ('OWN', 'REFERRAL');

-- AlterTable
ALTER TABLE "PayoutEntitlement" ADD COLUMN     "kind" "PayoutEntitlementKind" NOT NULL DEFAULT 'OWN';

-- CreateIndex
CREATE INDEX "PayoutEntitlement_leadId_kind_idx" ON "PayoutEntitlement"("leadId", "kind");
