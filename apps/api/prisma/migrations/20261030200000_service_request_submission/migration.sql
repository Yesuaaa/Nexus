ALTER TABLE "ServiceRequest"
  ADD COLUMN "packageId" TEXT,
  ADD COLUMN "projectGoals" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "projectRequirements" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "expectedTimeline" VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN "additionalDetails" TEXT,
  ADD COLUMN "preferredSpecialistId" TEXT,
  ADD COLUMN "preferredSpecialistName" TEXT,
  ADD COLUMN "quotedPrice" DECIMAL(12,2),
  ADD COLUMN "submissionKey" VARCHAR(36);

CREATE INDEX "ServiceRequest_packageId_idx" ON "ServiceRequest"("packageId");
CREATE INDEX "ServiceRequest_preferredSpecialistId_idx" ON "ServiceRequest"("preferredSpecialistId");
CREATE UNIQUE INDEX "ServiceRequest_clientId_submissionKey_key" ON "ServiceRequest"("clientId", "submissionKey");

ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_preferredSpecialistId_fkey"
  FOREIGN KEY ("preferredSpecialistId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
