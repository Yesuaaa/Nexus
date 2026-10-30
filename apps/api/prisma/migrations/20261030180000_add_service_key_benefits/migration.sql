CREATE TABLE "ServiceBenefit" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceBenefit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceBenefit_serviceId_displayOrder_idx"
ON "ServiceBenefit"("serviceId", "displayOrder");

ALTER TABLE "ServiceBenefit"
ADD CONSTRAINT "ServiceBenefit_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
