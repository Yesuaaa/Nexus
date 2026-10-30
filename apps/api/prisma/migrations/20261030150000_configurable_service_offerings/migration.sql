CREATE TYPE "PricingModel" AS ENUM ('FIXED', 'STARTING', 'CUSTOM_QUOTE', 'RECURRING', 'HOURLY');

CREATE TYPE "BillingInterval" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

CREATE TABLE "PricingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingModel" "PricingModel" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "amount" DECIMAL(12,2),
    "billingInterval" "BillingInterval",
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "includedFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricingModel" "PricingModel" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "amount" DECIMAL(12,2),
    "billingInterval" "BillingInterval",
    "isPricingPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Service"
ADD COLUMN "imageDataUrl" TEXT,
ADD COLUMN "imageAltText" TEXT,
ADD COLUMN "clientRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "requiresConsultation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "consultationNotes" TEXT,
ADD COLUMN "pricingTemplateId" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN "pricingModel" "PricingModel",
ADD COLUMN "agreedPrice" DECIMAL(12,2),
ADD COLUMN "currency" TEXT,
ADD COLUMN "billingInterval" "BillingInterval",
ADD COLUMN "packageName" TEXT;

CREATE UNIQUE INDEX "PricingTemplate_name_key" ON "PricingTemplate"("name");
CREATE INDEX "PricingTemplate_pricingModel_idx" ON "PricingTemplate"("pricingModel");
CREATE UNIQUE INDEX "ServicePackage_serviceId_name_key" ON "ServicePackage"("serviceId", "name");
CREATE INDEX "ServicePackage_serviceId_isActive_displayOrder_idx" ON "ServicePackage"("serviceId", "isActive", "displayOrder");
CREATE INDEX "Service_pricingTemplateId_idx" ON "Service"("pricingTemplateId");

ALTER TABLE "Service" ADD CONSTRAINT "Service_pricingTemplateId_fkey"
FOREIGN KEY ("pricingTemplateId") REFERENCES "PricingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
