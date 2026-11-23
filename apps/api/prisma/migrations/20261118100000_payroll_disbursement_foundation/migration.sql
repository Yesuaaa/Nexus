CREATE TYPE "PayrollDisbursementStatus" AS ENUM ('DRAFT', 'BLOCKED', 'CANCELLED');
CREATE TABLE "PayrollDisbursementBatch" (
  "id" TEXT PRIMARY KEY,
  "calculationId" TEXT NOT NULL UNIQUE REFERENCES "PayrollRunCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" "PayrollDisbursementStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'PHP' CHECK ("currency" = 'PHP'),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "PayrollDisbursementBatch_status_createdAt_id_idx"
ON "PayrollDisbursementBatch"("status", "createdAt", "id");
