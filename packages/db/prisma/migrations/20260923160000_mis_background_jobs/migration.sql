-- CreateEnum
CREATE TYPE "MisJobKind" AS ENUM ('PREVIEW', 'APPLY');

-- CreateEnum
CREATE TYPE "MisJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "MisImportBatch" ADD COLUMN     "jobError" TEXT,
ADD COLUMN     "jobFinishedAt" TIMESTAMP(3),
ADD COLUMN     "jobHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "jobKind" "MisJobKind",
ADD COLUMN     "jobProgress" JSONB,
ADD COLUMN     "jobQueuedAt" TIMESTAMP(3),
ADD COLUMN     "jobRequestedByUserId" TEXT,
ADD COLUMN     "jobStartedAt" TIMESTAMP(3),
ADD COLUMN     "jobStatus" "MisJobStatus";
