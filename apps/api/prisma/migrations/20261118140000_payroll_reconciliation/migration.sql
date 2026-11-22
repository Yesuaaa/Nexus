CREATE TYPE "PayrollReconciliationExceptionStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

CREATE TABLE "PayrollReconciliationException" (
  "calculationId" TEXT NOT NULL REFERENCES "PayrollRunCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "category" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "status" "PayrollReconciliationExceptionStatus" NOT NULL DEFAULT 'OPEN',
  "firstEvidence" JSONB NOT NULL,
  "lastEvidence" JSONB NOT NULL,
  "firstDetectedAt" TIMESTAMPTZ(3) NOT NULL,
  "lastObservedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PayrollReconciliationException_pkey" PRIMARY KEY ("calculationId", "category", "subjectId")
);
