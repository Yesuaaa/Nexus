CREATE TABLE "SpecialistSocialLink" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "platform" VARCHAR(40) NOT NULL,
  "url" VARCHAR(2048) NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpecialistSocialLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "specialist_social_link_order_idx"
  ON "SpecialistSocialLink"("employeeId", "displayOrder");

ALTER TABLE "SpecialistSocialLink"
  ADD CONSTRAINT "SpecialistSocialLink_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
