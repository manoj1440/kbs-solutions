-- A21: Telecaller calling interests can carry a bank application reference; MIS apply writes their bank status.
-- AlterTable
ALTER TABLE "CallingInterest" ADD COLUMN     "bankReferenceAt" TIMESTAMP(3),
ADD COLUMN     "bankReferenceBankId" TEXT,
ADD COLUMN     "bankReferenceKind" "BankReferenceKind",
ADD COLUMN     "bankReferenceValue" TEXT,
ADD COLUMN     "bankReferenceVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MisRow" ADD COLUMN     "matchedCallingInterestId" TEXT;

-- CreateTable
CREATE TABLE "CallingBankStatus" (
    "id" TEXT NOT NULL,
    "callingInterestId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "applicationNo" TEXT,
    "currentStage" TEXT,
    "finalDecision" TEXT,
    "cardActivationStatus" TEXT,
    "finalDecisionDate" TIMESTAMP(3),
    "firstMatchedAt" TIMESTAMP(3) NOT NULL,
    "lastMatchedAt" TIMESTAMP(3) NOT NULL,
    "lastMatchedBatchId" TEXT NOT NULL,

    CONSTRAINT "CallingBankStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallingBankStatus_callingInterestId_key" ON "CallingBankStatus"("callingInterestId");

-- CreateIndex
CREATE UNIQUE INDEX "CallingInterest_bankReferenceBankId_bankReferenceKind_bankR_key" ON "CallingInterest"("bankReferenceBankId", "bankReferenceKind", "bankReferenceValue");

-- AddForeignKey
ALTER TABLE "CallingBankStatus" ADD CONSTRAINT "CallingBankStatus_callingInterestId_fkey" FOREIGN KEY ("callingInterestId") REFERENCES "CallingInterest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisRow" ADD CONSTRAINT "MisRow_matchedCallingInterestId_fkey" FOREIGN KEY ("matchedCallingInterestId") REFERENCES "CallingInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- F-903 / INV-01: the same MIS-apply-only guard as BankStatusSnapshot
DROP TRIGGER IF EXISTS "CallingBankStatus_mis_apply_only" ON "CallingBankStatus";
CREATE TRIGGER "CallingBankStatus_mis_apply_only" BEFORE INSERT OR UPDATE OR DELETE ON "CallingBankStatus"
  FOR EACH ROW EXECUTE FUNCTION kbs_guard_bank_status();
