BEGIN;

-- CreateEnum
CREATE TYPE "PayrollRequestType" AS ENUM ('MISSING_PAYSLIP', 'PAYSLIP_CORRECTION', 'PAYROLL_DISCREPANCY', 'MISSING_SALARY_PAYMENT');

-- CreateEnum
CREATE TYPE "PayrollRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "PayrollPayslip" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "document" BYTEA NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "publishedBy" TEXT,

    CONSTRAINT "PayrollPayslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEmployeeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payslipId" TEXT,
    "type" "PayrollRequestType" NOT NULL,
    "status" "PayrollRequestStatus" NOT NULL DEFAULT 'OPEN',
    "needsFinancialCorrection" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PayrollEmployeeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayslip_itemId_key" ON "PayrollPayslip"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayslip_reference_key" ON "PayrollPayslip"("reference");

-- CreateIndex
CREATE INDEX "PayrollEmployeeRequest_employeeId_createdAt_idx" ON "PayrollEmployeeRequest"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollEmployeeRequest_status_type_createdAt_idx" ON "PayrollEmployeeRequest"("status", "type", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollRequestMessage_requestId_createdAt_idx" ON "PayrollRequestMessage"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "PayrollPayslip" ADD CONSTRAINT "PayrollPayslip_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PayrollRunItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeRequest" ADD CONSTRAINT "PayrollEmployeeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeRequest" ADD CONSTRAINT "PayrollEmployeeRequest_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "PayrollPayslip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRequestMessage" ADD CONSTRAINT "PayrollRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PayrollEmployeeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TYPE "WorkforceManagementAction" ADD VALUE 'PAYROLL_DOCUMENT_ACTIVITY';
ALTER TYPE "WorkforceManagementSubject" ADD VALUE 'PAYROLL_REQUEST';

ALTER TABLE "PayrollPayslip" ADD CONSTRAINT payroll_publication_pair
  CHECK (("publishedAt" IS NULL) = ("publishedBy" IS NULL));

CREATE FUNCTION guard_payroll_payslip() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payslips are retained for payroll history';
  END IF;
  IF OLD."publishedAt" IS NOT NULL
    OR NEW."publishedAt" IS NULL
    OR (to_jsonb(OLD) - ARRAY['publishedAt','publishedBy']) <>
       (to_jsonb(NEW) - ARRAY['publishedAt','publishedBy']) THEN
    RAISE EXCEPTION 'Payslip documents are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payroll_payslip_immutable BEFORE UPDATE OR DELETE ON "PayrollPayslip"
  FOR EACH ROW EXECUTE FUNCTION guard_payroll_payslip();

CREATE FUNCTION guard_payroll_request_relationship() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."payslipId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PayrollPayslip" p JOIN "PayrollRunItem" i ON i.id = p."itemId"
    WHERE p.id = NEW."payslipId" AND i."employeeId" = NEW."employeeId"
      AND p."publishedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Request payslip must be published and belong to the employee';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payroll_request_payslip_owner BEFORE INSERT OR UPDATE OF "payslipId", "employeeId"
  ON "PayrollEmployeeRequest" FOR EACH ROW EXECUTE FUNCTION guard_payroll_request_relationship();

ALTER TABLE "PayrollEmployeeRequest" ADD CONSTRAINT payroll_request_resolution_pair
  CHECK (("resolvedAt" IS NOT NULL) = ("status" IN ('RESOLVED', 'CLOSED')));

CREATE FUNCTION guard_payslip_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_item TEXT;
  new_item TEXT;
BEGIN
  IF TG_TABLE_NAME = 'PayrollRunItem' THEN
    old_item := OLD.id;
  ELSE
    IF TG_OP <> 'INSERT' THEN old_item := OLD."itemId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_item := NEW."itemId"; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM "PayrollPayslip" WHERE "itemId" IN (old_item, new_item)) THEN
    RAISE EXCEPTION 'Payslip source amounts are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payroll_payslip_source_item BEFORE UPDATE OR DELETE ON "PayrollRunItem"
  FOR EACH ROW EXECUTE FUNCTION guard_payslip_source();
CREATE TRIGGER payroll_payslip_source_component BEFORE INSERT OR UPDATE OR DELETE ON "PayrollRunItemComponent"
  FOR EACH ROW EXECUTE FUNCTION guard_payslip_source();

COMMIT;