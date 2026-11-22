BEGIN;
ALTER TYPE "PayrollRunStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'APPROVED';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'REJECTED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_SUBMITTED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_APPROVED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_REJECTED';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_RETURNED_FOR_REVISION';
ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_RESUBMITTED';

CREATE TABLE "PayrollApprovalEvent" (
    "id" TEXT PRIMARY KEY,
    "calculationId" TEXT NOT NULL REFERENCES "PayrollRunCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "action" "WorkforceManagementAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_rejection_reason" CHECK (
      CASE WHEN "action"::text = 'PAYROLL_REJECTED'
           THEN "reason" IS NOT NULL AND length(trim("reason")) >= 5
           ELSE "reason" IS NULL END
    )
);
CREATE UNIQUE INDEX "PayrollApprovalEvent_calculationId_action_key"
    ON "PayrollApprovalEvent" ("calculationId", "action");

CREATE FUNCTION prevent_payroll_approval_event_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Payroll approval history is append-only';
END;
$$;
CREATE TRIGGER payroll_approval_event_immutable
    BEFORE UPDATE OR DELETE ON "PayrollApprovalEvent"
    FOR EACH ROW EXECUTE FUNCTION prevent_payroll_approval_event_change();
COMMIT;
