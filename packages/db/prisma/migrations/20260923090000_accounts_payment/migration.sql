-- F-605 Accounts payment recording (REQ-17 §17.6–§17.7, REQ-18). Generated with the WASM schema engine
-- (schema-to-schema diff), then `transferReferenceKey` made safe for non-empty tables.

-- AlterEnum
ALTER TYPE "ExternalPaymentState" ADD VALUE 'CORRECTION_PENDING';
ALTER TYPE "ExternalPaymentState" ADD VALUE 'SUPERSEDED';
ALTER TYPE "ExternalPaymentState" ADD VALUE 'CORRECTION_REJECTED';

-- DropIndex (corrections append rows, uniqueness moves to partial indexes in the next migration)
DROP INDEX "ExternalPayment_requestId_key";

-- DropIndex
DROP INDEX "ExternalPayment_transferReference_key";

-- AlterTable
ALTER TABLE "PayoutRequest" ADD COLUMN     "heldAt" TIMESTAMP(3),
ADD COLUMN     "heldByUserId" TEXT,
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ExternalPayment" ADD COLUMN     "correctionDecidedAt" TIMESTAMP(3),
ADD COLUMN     "correctionDecidedByUserId" TEXT,
ADD COLUMN     "correctionDecisionReason" TEXT,
ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "exceptionRaisedAt" TIMESTAMP(3),
ADD COLUMN     "exceptionRaisedByUserId" TEXT,
ADD COLUMN     "proofAttachedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByUserId" TEXT,
ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "transferReferenceKey" TEXT;

UPDATE "ExternalPayment" SET "transferReferenceKey" = upper(regexp_replace("transferReference", '\s', '', 'g')) WHERE "transferReferenceKey" IS NULL;
ALTER TABLE "ExternalPayment" ALTER COLUMN "transferReferenceKey" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ExternalPayment_requestId_createdAt_idx" ON "ExternalPayment"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalPayment_transferReferenceKey_idx" ON "ExternalPayment"("transferReferenceKey");

-- CreateIndex
CREATE INDEX "ExternalPayment_state_createdAt_idx" ON "ExternalPayment"("state", "createdAt");

-- AddForeignKey
ALTER TABLE "ExternalPayment" ADD CONSTRAINT "ExternalPayment_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "ExternalPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
