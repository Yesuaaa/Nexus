ALTER TABLE "Employee"
  ADD COLUMN "profileBio" VARCHAR(2000),
  ADD COLUMN "profileImageUrl" VARCHAR(2048),
  ADD COLUMN "profileSpecialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "SpecialistPortfolioProject" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "summary" VARCHAR(3000) NOT NULL,
  "contribution" VARCHAR(2000),
  "thumbnailUrl" VARCHAR(2048),
  "projectUrl" VARCHAR(2048),
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpecialistPortfolioProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "specialist_portfolio_published_order_idx" ON "SpecialistPortfolioProject"("employeeId", "isPublished", "displayOrder");
ALTER TABLE "SpecialistPortfolioProject" ADD CONSTRAINT "SpecialistPortfolioProject_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
