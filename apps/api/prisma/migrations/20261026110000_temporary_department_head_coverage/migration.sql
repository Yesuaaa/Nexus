ALTER TABLE "Department"
ADD COLUMN "temporaryHeadOriginalId" TEXT,
ADD COLUMN "temporaryHeadAssignedId" TEXT;

CREATE UNIQUE INDEX "Department_temporaryHeadOriginalId_key"
ON "Department"("temporaryHeadOriginalId");

CREATE UNIQUE INDEX "Department_temporaryHeadAssignedId_key"
ON "Department"("temporaryHeadAssignedId");

ALTER TABLE "Department"
ADD CONSTRAINT "Department_temporaryHeadOriginalId_fkey"
FOREIGN KEY ("temporaryHeadOriginalId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Department"
ADD CONSTRAINT "Department_temporaryHeadAssignedId_fkey"
FOREIGN KEY ("temporaryHeadAssignedId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
