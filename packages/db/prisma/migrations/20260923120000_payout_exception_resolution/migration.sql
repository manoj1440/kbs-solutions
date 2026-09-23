-- F-606 payout exception acknowledgements (derived exceptions are computed on read)
-- CreateTable
CREATE TABLE "PayoutExceptionResolution" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "resolvedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutExceptionResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutExceptionResolution_kind_subjectId_key" ON "PayoutExceptionResolution"("kind", "subjectId");

-- AddForeignKey
ALTER TABLE "PayoutExceptionResolution" ADD CONSTRAINT "PayoutExceptionResolution_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
