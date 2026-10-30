-- AlterTable
ALTER TABLE "ServiceRequest"
ADD COLUMN "referenceNumber" TEXT,
ADD COLUMN "requirementsPayload" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_referenceNumber_key" ON "ServiceRequest"("referenceNumber");

-- CreateIndex
CREATE INDEX "ServiceRequest_referenceNumber_idx" ON "ServiceRequest"("referenceNumber");
