-- REQ-23 §23.4 (stale earlier batch): each MIS batch can carry the day the bank's sheet is for; apply skips rows whose
-- batch is older than the batch that last set the lead's (or calling interest's) bank status, and marks the row instead.
-- Additive only: no change to BankStatusSnapshot / BankStatusHistory / CallingBankStatus or their INV-01 triggers.
-- AlterTable
ALTER TABLE "MisImportBatch" ADD COLUMN     "reportDate" DATE;

-- AlterTable
ALTER TABLE "MisRow" ADD COLUMN     "applyNote" TEXT,
ADD COLUMN     "staleReport" BOOLEAN NOT NULL DEFAULT false;
