-- AlterTable
ALTER TABLE "ServiceRequest"
ADD COLUMN "packageId" TEXT,
ADD COLUMN "preferredSpecialistId" TEXT,
ADD COLUMN "referenceNumber" TEXT,
ADD COLUMN "requirementsPayload" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_referenceNumber_key" ON "ServiceRequest"("referenceNumber");

-- CreateIndex
CREATE INDEX "ServiceRequest_packageId_idx" ON "ServiceRequest"("packageId");

-- CreateIndex
CREATE INDEX "ServiceRequest_referenceNumber_idx" ON "ServiceRequest"("referenceNumber");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_preferredSpecialistId_fkey" FOREIGN KEY ("preferredSpecialistId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

