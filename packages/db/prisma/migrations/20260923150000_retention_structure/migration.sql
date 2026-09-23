-- AlterTable
ALTER TABLE "CallingRecord" ADD COLUMN     "legalHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalHoldReason" TEXT,
ADD COLUMN     "restrictedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "legalHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalHoldReason" TEXT,
ADD COLUMN     "purgedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "StoredFile_purgedAt_legalHold_idx" ON "StoredFile"("purgedAt", "legalHold");
