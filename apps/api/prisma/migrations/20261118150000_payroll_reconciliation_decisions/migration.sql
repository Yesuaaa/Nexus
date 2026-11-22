ALTER TABLE "PayrollReconciliationException"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "observed" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE "PayrollReconciliationDecision" (
  "id" TEXT PRIMARY KEY,
  "calculationId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "requestId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previous" "PayrollReconciliationExceptionStatus" NOT NULL,
  "next" "PayrollReconciliationExceptionStatus" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "classification" TEXT,
  "assessment" TEXT,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_reconcile_decision_exception_fk"
    FOREIGN KEY ("calculationId", "category", "subjectId")
    REFERENCES "PayrollReconciliationException" ("calculationId", "category", "subjectId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payroll_reconcile_decision_request_uq"
  ON "PayrollReconciliationDecision" ("calculationId", "category", "subjectId", "requestId");
CREATE UNIQUE INDEX "payroll_reconcile_decision_version_uq"
  ON "PayrollReconciliationDecision" ("calculationId", "category", "subjectId", "version");
