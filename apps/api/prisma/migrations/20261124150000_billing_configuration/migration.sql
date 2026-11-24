ALTER TABLE "InvoicePayment" ADD COLUMN "methodLabel" VARCHAR(100);
CREATE TABLE "BillingConfiguration" (
  "id" TEXT NOT NULL,
  "defaultTerms" VARCHAR(2000) NOT NULL DEFAULT '',
  "defaultDueDays" INTEGER NOT NULL DEFAULT 30,
  "invoicePrefix" VARCHAR(20) NOT NULL DEFAULT 'INV',
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingConfiguration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingConfiguration_dueDays_range" CHECK ("defaultDueDays" BETWEEN 0 AND 365)
);
INSERT INTO "BillingConfiguration" ("id") VALUES ('global');
CREATE TABLE "BillingPaymentMethod" (
  "id" TEXT NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingPaymentMethod_label_key" ON "BillingPaymentMethod"("label");
