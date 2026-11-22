ALTER TABLE "PayrollEmployeeRequest"
ADD COLUMN "withdrawnAt" TIMESTAMPTZ(3),
ADD COLUMN "withdrawnBy" TEXT;

CREATE INDEX "PayrollEmployeeRequest_employeeId_withdrawnAt_createdAt_id_idx"
ON "PayrollEmployeeRequest"("employeeId", "withdrawnAt", "createdAt", "id");

ALTER TABLE "PayrollEmployeeRequest"
DROP CONSTRAINT payroll_request_resolution_pair;

ALTER TABLE "PayrollEmployeeRequest"
ADD CONSTRAINT payroll_request_resolution_pair
CHECK (
  ("resolvedAt" IS NOT NULL) = (
    "status" = 'RESOLVED' OR ("status" = 'CLOSED' AND "withdrawnAt" IS NULL)
  )
);

ALTER TABLE "PayrollEmployeeRequest"
ADD CONSTRAINT payroll_request_withdrawal_pair
CHECK (
  "withdrawnAt" IS NULL OR (
    "status" = 'CLOSED' AND "resolvedAt" IS NULL AND "withdrawnBy" IS NOT NULL
  )
);
