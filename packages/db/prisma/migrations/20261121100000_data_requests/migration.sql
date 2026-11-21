-- F-908 data-principal request queue. Additive only: new enums, a new table, one new NotificationKind value.

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DATA_REQUEST';

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'OPEN',
    "details" TEXT,
    "staffNote" TEXT,
    "resolutionNote" TEXT,
    "handledByUserId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataRequest_publicRef_key" ON "DataRequest"("publicRef");

-- CreateIndex
CREATE INDEX "DataRequest_requesterUserId_createdAt_idx" ON "DataRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "DataRequest_status_createdAt_idx" ON "DataRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DataRequest_type_status_idx" ON "DataRequest"("type", "status");

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one active (OPEN / IN_PROGRESS) request per user and type; closed requests stay as history.
CREATE UNIQUE INDEX "DataRequest_one_active_per_type_idx" ON "DataRequest"("requesterUserId", "type") WHERE "status" IN ('OPEN', 'IN_PROGRESS');
