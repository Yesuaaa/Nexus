CREATE TYPE "PayrollSandboxDestinationKind" AS ENUM ('TEST_BANK', 'TEST_EWALLET');
CREATE TYPE "PayrollSimulationOutcome" AS ENUM ('SUCCEEDED', 'FAILED', 'PENDING');

CREATE TABLE "PayrollDisbursementItem" (
  "id" TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL REFERENCES "PayrollDisbursementBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "payrollItemId" TEXT NOT NULL UNIQUE REFERENCES "PayrollRunItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" >= 0)
);
CREATE INDEX "PayrollDisbursementItem_batchId_idx" ON "PayrollDisbursementItem"("batchId");

INSERT INTO "PayrollDisbursementItem" ("id", "batchId", "payrollItemId", "amount")
SELECT 'payout-' || item."id", batch."id", item."id", item."netAmount"
FROM "PayrollDisbursementBatch" batch
JOIN "PayrollRunItem" item ON item."calculationId" = batch."calculationId";

CREATE TABLE "PayrollSandboxDestination" (
  "id" TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL UNIQUE REFERENCES "PayrollDisbursementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" "PayrollSandboxDestinationKind" NOT NULL,
  "lastFour" CHAR(4) NOT NULL CHECK ("lastFour" ~ '^[0-9]{4}$'),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL
);

CREATE TABLE "PayrollTransferAttempt" (
  "id" TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL UNIQUE REFERENCES "PayrollDisbursementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "idempotencyKey" UUID NOT NULL UNIQUE,
  "outcome" "PayrollSimulationOutcome" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL
);
